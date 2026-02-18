/**
 * Health Check Controller
 *
 * Rich health endpoint for monitoring and load balancers.
 * Returns 200 if healthy, 503 if database is disconnected.
 */

const mongoose = require('mongoose');
const os = require('os');

const DB_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

exports.getHealth = (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const healthy = dbState === 1;
    const mem = process.memoryUsage();

    const payload = {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      node: process.version,
      database: {
        status: DB_STATES[dbState] || 'unknown',
      },
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      },
      system: {
        loadAvg: os.loadavg().map(v => Math.round(v * 100) / 100),
        freeMem: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
        totalMem: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
      },
    };

    res.status(healthy ? 200 : 503).json(payload);
  } catch (error) {
    res.status(503).json({ status: 'error', message: 'Health check failed' });
  }
};
