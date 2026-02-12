/**
 * Remote Execution Utility
 *
 * Wraps command execution to support both local and SSH-based SLURM operations.
 * When SLURM_USE_SSH=true, commands are executed over a persistent SSH connection.
 * When disabled (default), commands delegate directly to child_process.
 */

const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');
const settings = require('../config/settings');
const logger = require('./logger');

// SSH connection state
let sshClient = null;
let sshReady = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let lastError = null;
let connecting = false;

const MAX_RECONNECT_DELAY = 30000;
const CONNECT_TIMEOUT = 20000;

/**
 * Check if SSH mode is enabled
 */
function isSSHMode() {
  return settings.SLURM_USE_SSH && !!settings.SLURM_SSH_HOST;
}

/**
 * Escape a string for safe use as a shell argument (POSIX single-quote method)
 */
function shellEscape(arg) {
  return "'" + String(arg).replace(/'/g, "'\\''") + "'";
}

/**
 * Resolve SSH private key path, expanding ~ to home directory
 */
function resolveKeyPath(keyPath) {
  if (!keyPath) {
    const defaultKey = path.join(process.env.HOME || '/root', '.ssh', 'id_rsa');
    return fs.existsSync(defaultKey) ? defaultKey : null;
  }
  if (keyPath.startsWith('~')) {
    keyPath = path.join(process.env.HOME || '/root', keyPath.slice(1));
  }
  return fs.existsSync(keyPath) ? keyPath : null;
}

/**
 * Create a new SSH connection
 */
function connect() {
  return new Promise((resolve, reject) => {
    if (sshReady && sshClient) {
      return resolve(sshClient);
    }

    if (connecting) {
      // Wait for in-progress connection with timeout
      let waited = 0;
      const waitInterval = setInterval(() => {
        waited += 100;
        if (sshReady && sshClient) {
          clearInterval(waitInterval);
          resolve(sshClient);
        } else if (!connecting || waited >= CONNECT_TIMEOUT) {
          clearInterval(waitInterval);
          reject(new Error('SSH connection failed or timed out'));
        }
      }, 100);
      return;
    }

    connecting = true;
    const client = new Client();

    const connectConfig = {
      host: settings.SLURM_SSH_HOST,
      port: settings.SLURM_SSH_PORT,
      username: settings.SLURM_SSH_USER,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
      readyTimeout: CONNECT_TIMEOUT,
    };

    // Prefer key-based auth
    const keyPath = resolveKeyPath(settings.SLURM_SSH_KEY_PATH);
    if (keyPath) {
      try {
        connectConfig.privateKey = fs.readFileSync(keyPath);
        logger.info(`[SSH] Using private key: ${keyPath}`);
      } catch (err) {
        logger.warn(`[SSH] Could not read key ${keyPath}: ${err.message}`);
      }
    }

    // Fallback: use SSH agent if available
    if (!connectConfig.privateKey && process.env.SSH_AUTH_SOCK) {
      connectConfig.agent = process.env.SSH_AUTH_SOCK;
      logger.info('[SSH] Using SSH agent');
    }

    client.on('ready', () => {
      logger.info(`[SSH] Connected to ${settings.SLURM_SSH_HOST}:${settings.SLURM_SSH_PORT}`);
      sshClient = client;
      sshReady = true;
      connecting = false;
      reconnectAttempts = 0;
      lastError = null;
      resolve(client);
    });

    client.on('error', (err) => {
      logger.error(`[SSH] Connection error: ${err.message}`);
      sshReady = false;
      connecting = false;
      lastError = err.message;
      scheduleReconnect();
      reject(err);
    });

    client.on('close', () => {
      logger.warn('[SSH] Connection closed');
      sshReady = false;
      connecting = false;
      scheduleReconnect();
    });

    client.on('end', () => {
      sshReady = false;
      connecting = false;
    });

    logger.info(`[SSH] Connecting to ${settings.SLURM_SSH_HOST}:${settings.SLURM_SSH_PORT} as ${settings.SLURM_SSH_USER}...`);
    client.connect(connectConfig);
  });
}

/**
 * Schedule a reconnection attempt with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectTimer || !isSSHMode()) return;

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;

  logger.info(`[SSH] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch((err) => {
      logger.error(`[SSH] Reconnect failed: ${err.message}`);
    });
  }, delay);
}

/**
 * Get the SSH client, connecting if necessary
 */
async function getSSHClient() {
  if (sshReady && sshClient) return sshClient;
  return connect();
}

/**
 * Execute a command with arguments (replaces child_process.execFile)
 * @param {string} command - The command to run
 * @param {string[]} args - Command arguments
 * @param {Object} options - Options (cwd, env, timeout)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function execCommand(command, args = [], options = {}) {
  if (!isSSHMode()) {
    return new Promise((resolve, reject) => {
      execFile(command, args, options, (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      });
    });
  }

  // SSH mode: build command string with escaped arguments
  const escapedArgs = args.map(arg => shellEscape(arg));
  const fullCommand = [command, ...escapedArgs].join(' ');

  const cmdWithCwd = options.cwd
    ? `cd ${shellEscape(options.cwd)} && ${fullCommand}`
    : fullCommand;

  const client = await getSSHClient();

  return new Promise((resolve, reject) => {
    client.exec(cmdWithCwd, (err, stream) => {
      if (err) return reject(err);

      let stdout = '';
      let stderr = '';

      stream.on('data', (data) => { stdout += data; });
      stream.stderr.on('data', (data) => { stderr += data; });

      stream.on('close', (code) => {
        if (code !== 0) {
          const error = new Error(`Command failed with code ${code}: ${command}`);
          error.code = code;
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  });
}

/**
 * Execute a shell command string (replaces child_process.exec)
 * @param {string} shellString - The full shell command
 * @param {Object} options - Options (cwd, timeout)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function execShell(shellString, options = {}) {
  if (!isSSHMode()) {
    return new Promise((resolve, reject) => {
      exec(shellString, options, (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      });
    });
  }

  const client = await getSSHClient();

  return new Promise((resolve, reject) => {
    client.exec(shellString, (err, stream) => {
      if (err) return reject(err);

      let stdout = '';
      let stderr = '';

      stream.on('data', (data) => { stdout += data; });
      stream.stderr.on('data', (data) => { stderr += data; });

      stream.on('close', (code) => {
        if (code !== 0) {
          const error = new Error(`Shell command failed with code ${code}`);
          error.code = code;
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  });
}

/**
 * Write a file (locally or via SFTP in SSH mode)
 * @param {string} filePath - Absolute path to write to
 * @param {string} content - File content
 * @param {Object} options - Options (mode)
 */
async function writeRemoteFile(filePath, content, options = {}) {
  if (!isSSHMode()) {
    fs.writeFileSync(filePath, content, options);
    return;
  }

  const client = await getSSHClient();

  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) return reject(err);

      const writeStream = sftp.createWriteStream(filePath, {
        mode: options.mode || 0o755,
      });

      writeStream.on('close', () => {
        sftp.end();
        resolve();
      });

      writeStream.on('error', (writeErr) => {
        sftp.end();
        reject(writeErr);
      });

      writeStream.end(content);
    });
  });
}

/**
 * Create a temporary SSH session using per-user credentials.
 * Returns an object with execCommand / writeRemoteFile methods bound to
 * the user's private connection, plus a close() to tear it down.
 *
 * @param {Object} credentials - { username, privateKey }
 *   host/port default to the global SLURM_SSH_HOST/PORT from settings.
 * @returns {Promise<{execCommand, writeRemoteFile, close}>}
 */
async function createUserSSHSession(credentials) {
  const client = new Client();
  const host = settings.SLURM_SSH_HOST;
  const port = settings.SLURM_SSH_PORT || 22;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.end();
      reject(new Error('User SSH connection timed out'));
    }, CONNECT_TIMEOUT);

    client.on('ready', () => {
      clearTimeout(timer);
      resolve();
    });
    client.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    client.connect({
      host,
      port,
      username: credentials.username,
      privateKey: credentials.privateKey,
      readyTimeout: CONNECT_TIMEOUT,
    });
  });

  logger.info(`[SSH:User] Connected as ${credentials.username}@${host}:${port}`);

  return {
    /** Same API as the module-level execCommand, but over the user's connection */
    async execCommand(command, args = [], options = {}) {
      const escapedArgs = args.map(arg => shellEscape(arg));
      const fullCommand = [command, ...escapedArgs].join(' ');
      const cmdWithCwd = options.cwd
        ? `cd ${shellEscape(options.cwd)} && ${fullCommand}`
        : fullCommand;

      return new Promise((resolve, reject) => {
        client.exec(cmdWithCwd, (err, stream) => {
          if (err) return reject(err);
          let stdout = '';
          let stderr = '';
          stream.on('data', (data) => { stdout += data; });
          stream.stderr.on('data', (data) => { stderr += data; });
          stream.on('close', (code) => {
            if (code !== 0) {
              const error = new Error(`Command failed with code ${code}: ${command}`);
              error.code = code;
              error.stdout = stdout;
              error.stderr = stderr;
              reject(error);
            } else {
              resolve({ stdout, stderr });
            }
          });
        });
      });
    },

    /** Same API as the module-level writeRemoteFile, but over the user's connection */
    async writeRemoteFile(filePath, content, options = {}) {
      return new Promise((resolve, reject) => {
        client.sftp((err, sftp) => {
          if (err) return reject(err);
          const writeStream = sftp.createWriteStream(filePath, {
            mode: options.mode || 0o755,
          });
          writeStream.on('close', () => { sftp.end(); resolve(); });
          writeStream.on('error', (writeErr) => { sftp.end(); reject(writeErr); });
          writeStream.end(content);
        });
      });
    },

    close() {
      client.end();
      logger.info(`[SSH:User] Disconnected ${credentials.username}@${host}`);
    }
  };
}

/**
 * Get SSH connection status
 */
function getSSHStatus() {
  return {
    enabled: isSSHMode(),
    connected: sshReady,
    host: settings.SLURM_SSH_HOST || null,
    port: settings.SLURM_SSH_PORT,
    user: settings.SLURM_SSH_USER || null,
    lastError,
    reconnectAttempts,
  };
}

/**
 * Shutdown SSH connection
 */
function shutdown() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (sshClient) {
    logger.info('[SSH] Closing connection');
    sshClient.end();
    sshClient = null;
    sshReady = false;
  }
}

module.exports = {
  isSSHMode,
  execCommand,
  execShell,
  writeRemoteFile,
  createUserSSHSession,
  getSSHStatus,
  shutdown,
};
