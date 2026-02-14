/**
 * CryoProcess Node.js Backend Server
 *
 * Main entry point for the Express application.
 * Handles cryo-EM data processing job submission and management.
 */

// Load .env from project root (single config file for all settings)
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const requestLogger = require('./middleware/requestLogger');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const { connectDB } = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const { smartscopeAuth } = require('./middleware/auth');
const { getMonitor } = require('./services/slurmMonitor');
const { getWebSocketServer } = require('./services/websocket');
const { onJobStatusChange } = require('./services/thumbnailGenerator');
const { getEmailService } = require('./services/emailService');
const { onJobStatusChange: emailOnStatusChange } = require('./services/emailNotifier');
const { onJobStatusChange: webhookOnStatusChange } = require('./services/webhookNotifier');

// Route imports
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const jobRoutes = require('./routes/jobs');
const importRoutes = require('./routes/import');
const fileRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');
const clusterRoutes = require('./routes/cluster');
const slurmRoutes = require('./routes/slurm');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const liveSessionRoutes = require('./routes/liveSession');
const smartscopeRoutes = require('./routes/smartscope');
const usageRoutes = require('./routes/usage');
const auditRoutes = require('./routes/audit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Note: React build outputs use hashed script names, no inline scripts needed
      // If inline scripts break, use nonces with helmet-csp-nonce package
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  // Additional security headers
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' }
}));
// Parse comma-separated CORS origins from env
const parseCorsOrigins = (envValue) => {
  if (!envValue) return null;
  const origins = envValue.split(',').map(o => o.trim()).filter(Boolean);
  if (origins.length === 0) return null;
  if (origins.length === 1 && origins[0] === '*') return null; // reject wildcard
  return origins.length === 1 ? origins[0] : origins;
};

const corsOrigin = process.env.NODE_ENV === 'production'
  ? parseCorsOrigins(process.env.CORS_ORIGIN)
  : (process.env.CORS_ORIGIN || 'http://localhost:3000');

if (!corsOrigin && process.env.NODE_ENV === 'production') {
  logger.error('[CORS] CORS_ORIGIN must be set to specific domain(s) in production. Wildcard "*" is not allowed.');
  process.exit(1);
}

app.use(cors({
  origin: corsOrigin || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
app.use(cookieParser());
app.use(mongoSanitize());

// Rate limiting middleware (values from constants)
const { RATE_LIMITS } = require('./config/constants');

const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API_WINDOW_MS,
  max: RATE_LIMITS.API_MAX_REQUESTS,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH_WINDOW_MS,
  max: RATE_LIMITS.AUTH_MAX_REQUESTS,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

const registerLimiter = rateLimit({
  windowMs: RATE_LIMITS.REGISTER_WINDOW_MS,
  max: RATE_LIMITS.REGISTER_MAX_REQUESTS,
  message: { error: 'Too many registration attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const searchLimiter = rateLimit({
  windowMs: RATE_LIMITS.SEARCH_WINDOW_MS,
  max: RATE_LIMITS.SEARCH_MAX_REQUESTS,
  message: { error: 'Too many search requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 3,
  message: { error: 'Too many password reset attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply stricter rate limiting to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/users/search', searchLimiter);

// Request logging middleware (replaces morgan)
app.use(requestLogger());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization (trim strings, strip HTML, reject null bytes)
const sanitize = require('./middleware/sanitize');
app.use(sanitize());

// Static files (React frontend) - serve directly from frontend/build
app.use(express.static(path.join(__dirname, '../../frontend/build')));

// Swagger API docs (relax CSP for Swagger UI assets)
app.use('/api/docs', (req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:");
  next();
}, swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'CryoProcess API Docs' }));

// Health check endpoint (rich: DB status, uptime, memory, load)
const healthController = require('./controllers/healthController');
app.get('/api/health', healthController.getHealth);

// Software configuration endpoint (returns executable paths from .env)
const settings = require('./config/settings');
app.get('/api/software-config', authMiddleware, (req, res) => {
  res.json({
    success: true,
    motioncor2_exe: settings.MOTIONCOR2_EXE || '',
    ctffind_exe: settings.CTFFIND_EXE || '',
    gctf_exe: settings.GCTF_EXE || '',
    modelangelo_exe: settings.MODELANGELO_EXE || '',
    relion_path: settings.SINGULARITY_IMAGE || '',
    email_notifications_enabled: settings.EMAIL_NOTIFICATIONS_ENABLED && !!settings.SMTP_HOST,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/jobs', authMiddleware, jobRoutes);
app.use('/api/import', authMiddleware, importRoutes);
app.use('/api/files', authMiddleware, fileRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/admin/usage', authMiddleware, usageRoutes);
app.use('/api/admin/audit', authMiddleware, auditRoutes);
app.use('/api/cluster', authMiddleware, clusterRoutes);
app.use('/api/slurm', authMiddleware, slurmRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/live-sessions', authMiddleware, liveSessionRoutes);
app.use('/api/smartscope', smartscopeAuth, smartscopeRoutes);

// Legacy routes (Django-style URLs used by frontend)
const jobController = require('./controllers/jobController');
app.get('/jobs', authMiddleware, jobController.listJobs);
// Note: /jobs/tree moved to /api/jobs/tree in routes/jobs.js

// Motion dashboard legacy routes (Django-style URLs)
const dashboardController = require('./controllers/dashboardController');
app.get('/motion/results/', authMiddleware, dashboardController.getMotionResults);
app.get('/motion/live-stats/', authMiddleware, dashboardController.getMotionLiveStats);
app.get('/motion/shifts/', authMiddleware, dashboardController.getMicrographShifts);
app.get('/motion/image/', authMiddleware, dashboardController.getMicrographImage);

// CTF dashboard legacy routes (Django-style URLs)
app.get('/ctf/results/', authMiddleware, dashboardController.getCtfResults);
app.get('/ctf/live-stats/', authMiddleware, dashboardController.getCtfLiveStats);
app.get('/ctf/image/', authMiddleware, dashboardController.getCtfImage);
app.get('/ctf/micrograph-image/', authMiddleware, dashboardController.getCtfMicrographImage);
app.post('/ctf/export-selection/', authMiddleware, dashboardController.exportCtfSelection);
app.get('/ctf/download-selection/', authMiddleware, dashboardController.downloadCtfSelection);

// AutoPick dashboard legacy routes
app.get('/autopick/results/', authMiddleware, dashboardController.getAutopickResults);
app.get('/autopick/image/', authMiddleware, dashboardController.getAutopickImage);
app.get('/autopick/live-stats/', authMiddleware, dashboardController.getAutopickLiveStats);

// Extract (Particle Extraction) dashboard legacy routes
app.get('/extract/results/', authMiddleware, dashboardController.getExtractResults);
app.get('/extract/particles-image/', authMiddleware, dashboardController.getExtractParticlesImage);
app.get('/extract/live-stats/', authMiddleware, dashboardController.getExtractLiveStats);

// Class2D dashboard legacy routes
app.get('/class2d/results/', authMiddleware, dashboardController.getClass2dResults);
app.get('/class2d/classes-image/', authMiddleware, dashboardController.getClass2dClassesImage);
app.get('/class2d/live-stats/', authMiddleware, dashboardController.getClass2dLiveStats);
app.get('/class2d/individual-images/', authMiddleware, dashboardController.getClass2dIndividualImages);
app.post('/class2d/save-selection/', authMiddleware, dashboardController.saveSelectedClasses);

// ManualSelect dashboard legacy routes
app.get('/manualselect/results/', authMiddleware, dashboardController.getManualSelectResults);

// 3D Initial Model dashboard legacy routes
app.get('/initialmodel/results/', authMiddleware, dashboardController.getInitialModelResults);
app.get('/initialmodel/mrc/', authMiddleware, dashboardController.getInitialModelMrc);
app.get('/initialmodel/live-stats/', authMiddleware, dashboardController.getInitialModelLiveStats);
app.get('/initialmodel/slices/', authMiddleware, dashboardController.getInitialModelSlices);

// 3D Classification dashboard legacy routes
app.get('/class3d/results/', authMiddleware, dashboardController.getClass3dResults);
app.get('/class3d/mrc/', authMiddleware, dashboardController.getClass3dMrc);
app.get('/class3d/live-stats/', authMiddleware, dashboardController.getClass3dLiveStats);

// 3D Auto-Refine dashboard legacy routes
app.get('/autorefine/results/', authMiddleware, dashboardController.getAutoRefineResults);
app.get('/autorefine/mrc/', authMiddleware, dashboardController.getAutoRefineMrc);
app.get('/autorefine/live-stats/', authMiddleware, dashboardController.getAutoRefineLiveStats);
app.get('/autorefine/fsc/', authMiddleware, dashboardController.getAutoRefineFsc);

// Mask Creation dashboard legacy routes
app.get('/maskcreate/results/', authMiddleware, dashboardController.getMaskCreateResults);
app.get('/maskcreate/mrc/', authMiddleware, dashboardController.getMaskCreateMrc);

// CTF Refinement dashboard legacy routes
app.get('/ctfrefine/results/', authMiddleware, dashboardController.getCtfRefineResults);
app.get('/ctfrefine/pdf/', authMiddleware, dashboardController.getCtfRefinePdf);

// Bayesian Polishing dashboard legacy routes
app.get('/polish/results/', authMiddleware, dashboardController.getPolishResults);
app.get('/polish/output/', authMiddleware, dashboardController.getPolishOutput);

// Particle Subtraction dashboard routes
app.get('/subtract/results/', authMiddleware, dashboardController.getSubtractResults);

// Join Star Files dashboard routes
app.get('/joinstar/results/', authMiddleware, dashboardController.getJoinStarResults);

// Post Processing dashboard legacy routes
app.get('/postprocess/results/', authMiddleware, dashboardController.getPostProcessResults);
app.get('/postprocess/mrc/', authMiddleware, dashboardController.getPostProcessMrc);
app.get('/postprocess/fsc/', authMiddleware, dashboardController.getPostProcessFsc);

// Local Resolution dashboard legacy routes
app.get('/localres/results/', authMiddleware, dashboardController.getLocalResResults);
app.get('/localres/mrc/', authMiddleware, dashboardController.getLocalResMrc);

// ModelAngelo dashboard legacy routes
app.get('/modelangelo/results/', authMiddleware, dashboardController.getModelAngeloResults);
app.get('/modelangelo/pdb/', authMiddleware, dashboardController.getModelAngeloPdb);

// DynaMight dashboard legacy routes
app.get('/dynamight/results/', authMiddleware, dashboardController.getDynamightResults);
app.get('/dynamight/mrc/', authMiddleware, dashboardController.getDynamightMrc);

// Import dashboard legacy routes
app.get('/api/import/results/:jobId/', authMiddleware, dashboardController.getImportResults);
app.get('/import/logs', authMiddleware, dashboardController.getImportLogs);
app.get('/api/import/movie-frame/', authMiddleware, dashboardController.getMovieFrame);
app.get('/api/import/mrc/', authMiddleware, dashboardController.getImportMrc);

// Motion logs legacy route
app.get('/motion/logs', authMiddleware, dashboardController.getMotionLogs);

// Folder browser legacy routes (alias to /api/files/browse)
const fileController = require('./controllers/fileController');
app.get('/api/browse-folder/', authMiddleware, fileController.browseFolder);

// Particle metadata API (for smart defaults in forms)
app.get('/api/particle-metadata/', authMiddleware, dashboardController.getParticleMetadata);

// Stage files API routes (for job input selection)
app.get('/api/stage-files/', authMiddleware, fileController.getStageStarFiles);
app.get('/api/stage-mrc-files/', authMiddleware, fileController.getStageMrcFiles);
app.get('/api/stage-optimiser-files/', authMiddleware, fileController.getStageOptimiserFiles);

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('[MongoDB] Connected successfully');

    // Initialize WebSocket server
    const wsServer = getWebSocketServer();
    wsServer.initialize(server);
    wsServer.startHeartbeat();

    // Log SSH remote cluster mode if enabled
    const { isSSHMode, shutdown: shutdownSSH } = require('./utils/remoteExec');
    if (isSSHMode()) {
      logger.info(`[SSH] Remote cluster mode enabled — SLURM commands will run over SSH to ${process.env.SLURM_SSH_HOST}`);
    }

    // Create SLURM monitor (but don't start polling yet)
    const slurmMonitor = getMonitor({
      pollInterval: parseInt(process.env.SLURM_POLL_INTERVAL) || 10000
    });

    // Register ALL event listeners BEFORE starting the monitor
    // to prevent lost events during the startup window
    slurmMonitor.on('statusChange', onJobStatusChange);

    // Initialize email notification service and register listener
    const emailService = getEmailService();
    emailService.initialize();
    slurmMonitor.on('statusChange', emailOnStatusChange);
    slurmMonitor.on('statusChange', webhookOnStatusChange);

    const { getLiveOrchestrator } = require('./services/liveOrchestrator');
    const liveOrchestrator = getLiveOrchestrator();
    liveOrchestrator.initialize(); // Registers its statusChange listener

    // NOW start polling - all listeners are attached
    slurmMonitor.start();
    logger.info('[SLURM] Monitor started');

    // Resume any live sessions that were running before restart
    liveOrchestrator.resumeRunningSessions().catch(err => {
      logger.error(`[LiveOrchestrator] Failed to resume sessions: ${err.message}`);
    });

    server.listen(PORT, () => {
      logger.info(`[Server] Running on port ${PORT}`);
      logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('[Server] SIGTERM received, shutting down...');
      slurmMonitor.stop();
      shutdownSSH();
      wsServer.shutdown();
      await liveOrchestrator.shutdown();
      server.close(() => {
        logger.info('[Server] Closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('[Server] Failed to start:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };
