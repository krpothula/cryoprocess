/**
 * WebSocket Server
 *
 * Provides real-time updates to connected clients.
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');
const logger = require('../utils/logger');
const settings = require('../config/settings');
const { getMonitor } = require('./slurmMonitor');
const Project = require('../models/Project');
const ProjectMember = require('../models/ProjectMember');

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map<ws, { userId, projectId, subscriptions }>
    this.projectClients = new Map(); // Map<projectId, Set<ws>>
    this.heartbeatInterval = null;
  }

  /**
   * Initialize WebSocket server
   * @param {http.Server} server - HTTP server instance
   */
  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      maxPayload: 64 * 1024, // 64KB max message size
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Connect to SLURM monitor for status changes and progress updates
    const monitor = getMonitor();
    monitor.on('statusChange', (data) => {
      this.broadcastJobUpdate(data);
    });
    monitor.on('progressChange', (data) => {
      this.broadcastJobProgress(data);
    });

    logger.info('[WebSocket] Server initialized');
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws
   * @param {http.IncomingMessage} req
   */
  handleConnection(ws, req) {
    // Reject if too many connections
    const MAX_CLIENTS = 200;
    if (this.clients.size >= MAX_CLIENTS) {
      logger.warn(`[WebSocket] Connection rejected: max clients (${MAX_CLIENTS}) reached`);
      ws.close(4013, 'Too many connections');
      return;
    }

    // Validate origin (basic CORS-like protection)
    const origin = req.headers.origin;
    const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
    const serverPort = process.env.PORT || '8001';
    const allowedHosts = [
      allowedOrigin.replace(/:\d+$/, ''),           // Frontend origin (strip port)
      `http://localhost`,                             // Same-host connections
      `http://127.0.0.1`,
    ];
    if (origin && !allowedHosts.some(h => origin.startsWith(h))) {
      logger.warn(`[WebSocket] Rejected connection from origin: ${origin}`);
      ws.close(4003, 'Origin not allowed');
      return;
    }

    // Parse token from cookie (primary) or query parameter (fallback)
    const parsedUrl = url.parse(req.url, true);
    let token = null;

    // 1. HttpOnly cookie from upgrade request headers
    const cookieHeader = req.headers.cookie || '';
    const atokenMatch = cookieHeader.match(/(?:^|;\s*)atoken=([^;]+)/);
    if (atokenMatch) {
      token = atokenMatch[1];
    }

    // 2. Query parameter fallback
    if (!token && parsedUrl.query.token) {
      token = parsedUrl.query.token;
    }

    if (!token) {
      logger.warn('[WebSocket] Connection rejected: No token provided');
      ws.close(4001, 'Authentication required');
      return;
    }

    let userId = null;
    try {
      const decoded = jwt.verify(token, settings.JWT_SECRET);
      userId = decoded.id || decoded.userId || decoded.user_id;
      logger.info(`[WebSocket] Authenticated connection | user: ${userId}`);
    } catch (error) {
      logger.warn(`[WebSocket] Connection rejected: Invalid token - ${error.message}`);
      ws.close(4001, 'Invalid token');
      return;
    }

    // Store client info
    this.clients.set(ws, {
      userId,
      projectId: null,
      subscriptions: new Set(),
      isAlive: true
    });

    // Send welcome message
    this.send(ws, {
      type: 'connected',
      authenticated: true,
      userId
    });

    // Handle messages
    ws.on('message', (message) => {
      this.handleMessage(ws, message);
    });

    // Handle close
    ws.on('close', () => {
      this.handleClose(ws);
    });

    // Handle pong for heartbeat
    ws.on('pong', () => {
      const client = this.clients.get(ws);
      if (client) {
        client.isAlive = true;
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`[WebSocket] Client error: ${error.message}`);
    });
  }

  /**
   * Handle incoming message
   * @param {WebSocket} ws
   * @param {string} message
   */
  handleMessage(ws, message) {
    let data;
    try {
      data = JSON.parse(message);
    } catch (error) {
      this.send(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    const client = this.clients.get(ws);
    if (!client) {
      return;
    }

    switch (data.type) {
      case 'subscribe':
        this.handleSubscribe(ws, client, data);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(ws, client, data);
        break;

      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      case 'get_live_state':
        this.handleGetLiveState(ws, client, data);
        break;

      default:
        logger.debug(`[WebSocket] Unknown message type: ${data.type}`);
    }
  }

  /**
   * Handle subscription request
   * @param {WebSocket} ws
   * @param {Object} client
   * @param {Object} data
   */
  async handleSubscribe(ws, client, data) {
    // Support both snake_case (from frontend) and camelCase
    const projectId = data.projectId || data.project_id;
    const { channel } = data;

    if (projectId) {
      // Verify user has access to this project
      const hasAccess = await this.verifyProjectAccess(client.userId, projectId);
      if (!hasAccess) {
        logger.warn(`[WebSocket] Subscription denied | user: ${client.userId} | project: ${projectId}`);
        this.send(ws, {
          type: 'error',
          message: 'Access denied to project',
          channel: `project:${projectId}`
        });
        return;
      }

      // Subscribe to project updates
      client.projectId = projectId;
      client.subscriptions.add(`project:${projectId}`);

      // Track in project clients map
      if (!this.projectClients.has(projectId)) {
        this.projectClients.set(projectId, new Set());
      }
      this.projectClients.get(projectId).add(ws);

      logger.debug(`[WebSocket] Client subscribed to project ${projectId}`);
      this.send(ws, {
        type: 'subscribed',
        channel: `project:${projectId}`
      });
    }

    if (channel) {
      client.subscriptions.add(channel);
      this.send(ws, {
        type: 'subscribed',
        channel
      });
    }
  }

  /**
   * Verify user has access to a project
   * @param {number} userId
   * @param {string} projectId
   * @returns {boolean}
   */
  async verifyProjectAccess(userId, projectId) {
    try {
      // Check if user is the project owner
      const project = await Project.findOne({ id: projectId });
      if (!project) {
        return false;
      }
      if (project.created_by_id === userId) {
        return true;
      }

      // Check if user is a project member
      const membership = await ProjectMember.findOne({
        projectId,
        user_id: userId
      });
      return !!membership;
    } catch (error) {
      logger.error(`[WebSocket] Error verifying project access: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle unsubscription request
   * @param {WebSocket} ws
   * @param {Object} client
   * @param {Object} data
   */
  handleUnsubscribe(ws, client, data) {
    // Support both snake_case and camelCase
    const projectId = data.projectId || data.project_id;
    const { channel } = data;

    if (projectId) {
      client.subscriptions.delete(`project:${projectId}`);

      const projectSet = this.projectClients.get(projectId);
      if (projectSet) {
        projectSet.delete(ws);
        if (projectSet.size === 0) {
          this.projectClients.delete(projectId);
        }
      }

      this.send(ws, {
        type: 'unsubscribed',
        channel: `project:${projectId}`
      });
    }

    if (channel) {
      client.subscriptions.delete(channel);
      this.send(ws, {
        type: 'unsubscribed',
        channel
      });
    }
  }

  /**
   * Handle request for current live session state (sent on reconnect)
   * @param {WebSocket} ws
   * @param {Object} client
   * @param {Object} data - { session_id }
   */
  async handleGetLiveState(ws, client, data) {
    const sessionId = data.session_id;
    if (!sessionId) return;

    try {
      const LiveSession = require('../models/LiveSession');
      const session = await LiveSession.findOne({ id: sessionId })
        .select('id status state jobs session_name pass_history')
        .lean();
      if (session) {
        this.send(ws, {
          type: 'live_session_state',
          session_id: sessionId,
          data: session,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      logger.debug(`[WebSocket] Failed to fetch live state: ${err.message}`);
    }
  }

  /**
   * Handle connection close
   * @param {WebSocket} ws
   */
  handleClose(ws) {
    const client = this.clients.get(ws);
    if (client) {
      // Remove from project clients
      for (const sub of client.subscriptions) {
        if (sub.startsWith('project:')) {
          const projectId = sub.split(':')[1];
          const projectSet = this.projectClients.get(projectId);
          if (projectSet) {
            projectSet.delete(ws);
            if (projectSet.size === 0) {
              this.projectClients.delete(projectId);
            }
          }
        }
      }
    }

    this.clients.delete(ws);
    logger.debug('[WebSocket] Client disconnected');
  }

  /**
   * Send message to a client
   * @param {WebSocket} ws
   * @param {Object} data
   */
  send(ws, data) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    } catch (err) {
      logger.debug(`[WebSocket] Send failed: ${err.message}`);
    }
  }

  /**
   * Broadcast job update to project subscribers
   * @param {Object} data - Status change data from SLURM monitor
   */
  broadcastJobUpdate(data) {
    const { projectId, jobId, oldStatus, newStatus, slurmStatus } = data;

    const message = {
      type: 'job_update',
      id: jobId,               // standardized field name
      projectId,
      status: newStatus,
      oldStatus,
      newStatus,
      slurmState: slurmStatus?.rawState,
      timestamp: new Date().toISOString()
    };

    // Send to all project subscribers
    const projectSubs = this.projectClients.get(projectId);
    if (projectSubs) {
      for (const ws of projectSubs) {
        this.send(ws, message);
      }
      logger.debug(`[WebSocket] Broadcast job update to ${projectSubs.size} clients | job: ${jobId}`);
    }
  }

  /**
   * Broadcast job progress (pipeline_stats changes) to project subscribers.
   * Sent periodically (every 5s poll cycle) when iteration_count, micrograph_count,
   * or particle_count changes for a running job.
   * @param {Object} data - Progress data from SLURM monitor
   */
  broadcastJobProgress(data) {
    const { projectId, jobId, jobType, iterationCount, micrographCount, particleCount, totalIterations, progressPercent } = data;

    const message = {
      type: 'job_progress',
      id: jobId,
      projectId,
      jobType,
      iterationCount,
      micrographCount,
      particleCount,
      totalIterations,
      progressPercent,
      timestamp: new Date().toISOString()
    };

    const projectSubs = this.projectClients.get(projectId);
    if (projectSubs) {
      for (const ws of projectSubs) {
        this.send(ws, message);
      }
      logger.debug(`[WebSocket] Broadcast job progress to ${projectSubs.size} clients | job: ${jobId} | iter: ${iterationCount} | mic: ${micrographCount}`);
    }
  }

  /**
   * Broadcast message to all subscribers of a channel
   * @param {string} channel
   * @param {Object} data
   */
  broadcast(channel, data) {
    // Optimized path for project channels: use projectClients map
    // instead of iterating all connected clients
    if (channel.startsWith('project:')) {
      const projectId = channel.slice('project:'.length);
      const projectSubs = this.projectClients.get(projectId);
      if (projectSubs) {
        for (const ws of projectSubs) {
          this.send(ws, data);
        }
      }
      return;
    }

    // Fallback for non-project channels
    for (const [ws, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        this.send(ws, data);
      }
    }
  }

  /**
   * Broadcast to all connected clients
   * @param {Object} data
   */
  broadcastAll(data) {
    for (const ws of this.clients.keys()) {
      this.send(ws, data);
    }
  }

  /**
   * Send message to a specific user
   * @param {number} userId
   * @param {Object} data
   */
  sendToUser(userId, data) {
    for (const [ws, client] of this.clients) {
      if (client.userId === userId) {
        this.send(ws, data);
      }
    }
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const [ws, client] of this.clients) {
        if (!client.isAlive) {
          // Clean up before terminate - terminate() fires 'close' event
          // which would call handleClose again, but by removing from clients
          // first, the second call becomes a no-op
          this.handleClose(ws);
          ws.terminate();
          continue;
        }

        client.isAlive = false;
        ws.ping();
      }
    }, 30000); // 30 seconds
  }

  /**
   * Graceful shutdown - close all connections and clear intervals
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.wss) {
      for (const ws of this.clients.keys()) {
        ws.close(1001, 'Server shutting down');
      }
      this.clients.clear();
      this.projectClients.clear();
    }
    logger.info('[WebSocket] Server shut down');
  }

  /**
   * Get connection stats
   * @returns {Object}
   */
  getStats() {
    const authenticated = [...this.clients.values()].filter(c => c.userId).length;
    return {
      total: this.clients.size,
      authenticated,
      anonymous: this.clients.size - authenticated,
      projects: this.projectClients.size
    };
  }
}

// Singleton instance
let wsServer = null;

/**
 * Get or create WebSocket server
 * @returns {WebSocketServer}
 */
const getWebSocketServer = () => {
  if (!wsServer) {
    wsServer = new WebSocketServer();
  }
  return wsServer;
};

module.exports = {
  WebSocketServer,
  getWebSocketServer
};
