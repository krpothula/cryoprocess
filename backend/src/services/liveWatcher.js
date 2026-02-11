/**
 * Live Session File Watcher
 *
 * Uses chokidar to watch directories for new movie files.
 * Debounces and batches file events to avoid overwhelming the pipeline.
 */

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class LiveWatcher extends EventEmitter {
  constructor() {
    super();
    this.watchers = new Map();       // sessionId -> chokidar watcher
    this.knownFiles = new Map();     // sessionId -> Set<filePath>
    this.debounceTimers = new Map(); // sessionId -> timer
    this.pendingFiles = new Map();   // sessionId -> Set<filePath>
  }

  /**
   * Start watching a directory for new movie files
   * @param {string} sessionId
   * @param {string} directory - Directory to watch
   * @param {string} pattern - Glob pattern (e.g., '*.tiff')
   * @param {string} inputMode - 'watch' or 'existing'
   */
  start(sessionId, directory, pattern = '*.tiff', inputMode = 'watch') {
    if (this.watchers.has(sessionId)) {
      logger.warn(`[LiveWatcher] Session ${sessionId} already being watched`);
      return;
    }
    this._inputModes = this._inputModes || new Map();
    this._inputModes.set(sessionId, inputMode);

    // Validate directory
    if (!fs.existsSync(directory)) {
      throw new Error(`Watch directory does not exist: ${directory}`);
    }

    // Build file extension filter from glob pattern (chokidar v4 dropped glob support)
    // Convert patterns like "*.tiff" or "*.mrc" to extension checks
    const extensions = pattern
      .split(',')
      .map(p => p.trim().replace(/^\*/, '').toLowerCase())
      .filter(Boolean);

    logger.info(`[LiveWatcher] Starting watch | session: ${sessionId} | dir: ${directory} | pattern: ${pattern} | extensions: ${extensions.join(',')} | mode: ${inputMode}`);

    this.knownFiles.set(sessionId, new Set());
    this.pendingFiles.set(sessionId, new Set());

    // For 'existing' mode, files are already complete - use fast scan.
    // For 'watch' mode, files may still be writing - use stability check.
    const awaitOpts = inputMode === 'existing'
      ? { stabilityThreshold: 500, pollInterval: 200 }
      : { stabilityThreshold: 2000, pollInterval: 500 };

    const watcher = chokidar.watch(directory, {
      persistent: true,
      ignoreInitial: false,  // Process existing files too
      awaitWriteFinish: awaitOpts,
      depth: 1,              // Watch subdirectories one level deep
      usePolling: false,      // Use native fs events (faster)
      alwaysstat: false,
      ignored: (filePath) => {
        // Allow directories to be traversed
        const ext = path.extname(filePath).toLowerCase();
        if (!ext) {
          // No extension: allow if it looks like a directory path (no dots in basename)
          // But ignore dotfiles like .gui_projectdir
          const base = path.basename(filePath);
          return base.startsWith('.');
        }
        // Filter files by extension
        return !extensions.includes(ext);
      }
    });

    watcher.on('add', (filePath) => {
      this._onFileAdded(sessionId, filePath);
    });

    watcher.on('error', (error) => {
      logger.error(`[LiveWatcher] Error in session ${sessionId}: ${error.message}`);
      this.emit('error', { sessionId, error: error.message });
    });

    watcher.on('ready', () => {
      const known = this.knownFiles.get(sessionId);
      const count = known ? known.size : 0;
      logger.info(`[LiveWatcher] Ready | session: ${sessionId} | existing files: ${count}`);

      // For "existing" mode, emit all files immediately and stop watching
      if (inputMode === 'existing') {
        if (count > 0) {
          this._flushPending(sessionId);
        } else {
          // No matching files found - emit empty event so orchestrator can handle it
          logger.warn(`[LiveWatcher] Existing mode: no matching files found in ${directory} | session: ${sessionId}`);
          this.emit('noFiles', { sessionId, directory });
        }
        // Stop watching - all existing files have been discovered
        watcher.close();
        this.watchers.delete(sessionId);
        logger.info(`[LiveWatcher] Existing mode: watcher closed after initial scan | session: ${sessionId}`);
      }
    });

    this.watchers.set(sessionId, watcher);
  }

  /**
   * Handle new file detection
   * @param {string} sessionId
   * @param {string} filePath
   */
  _onFileAdded(sessionId, filePath) {
    const known = this.knownFiles.get(sessionId);
    if (!known) return;

    // Skip if already seen
    if (known.has(filePath)) return;
    known.add(filePath);

    // Add to pending batch
    const pending = this.pendingFiles.get(sessionId);
    if (pending) {
      pending.add(filePath);
    }

    logger.debug(`[LiveWatcher] New file | session: ${sessionId} | file: ${path.basename(filePath)}`);

    // Debounce: wait 5 seconds after last file to batch process
    this._debouncedFlush(sessionId);
  }

  /**
   * Debounce file event batching (5s after last file)
   * @param {string} sessionId
   */
  _debouncedFlush(sessionId) {
    // Guard: don't set new timers if the session has been stopped
    if (!this.watchers.has(sessionId) && !this.pendingFiles.has(sessionId)) {
      return;
    }

    const existing = this.debounceTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }

    // Shorter debounce for 'existing' mode (files are all there already)
    const mode = this._inputModes?.get(sessionId) || 'watch';
    const debounceMs = mode === 'existing' ? 2000 : 5000;

    const timer = setTimeout(() => {
      this._flushPending(sessionId);
      this.debounceTimers.delete(sessionId);
    }, debounceMs);

    this.debounceTimers.set(sessionId, timer);
  }

  /**
   * Emit batched new files event
   * @param {string} sessionId
   */
  _flushPending(sessionId) {
    const pending = this.pendingFiles.get(sessionId);
    if (!pending || pending.size === 0) return;

    const files = Array.from(pending);
    pending.clear();

    logger.info(`[LiveWatcher] Batch ready | session: ${sessionId} | files: ${files.length}`);

    this.emit('newFiles', {
      sessionId,
      files,
      count: files.length
    });
  }

  /**
   * Stop watching for a session
   * @param {string} sessionId
   */
  async stop(sessionId) {
    const watcher = this.watchers.get(sessionId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(sessionId);
    }

    // Clear timers
    const timer = this.debounceTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(sessionId);
    }

    this.knownFiles.delete(sessionId);
    this.pendingFiles.delete(sessionId);
    if (this._inputModes) this._inputModes.delete(sessionId);

    logger.info(`[LiveWatcher] Stopped watching session ${sessionId}`);
  }

  /**
   * Get count of known files for a session
   * @param {string} sessionId
   * @returns {number}
   */
  getFileCount(sessionId) {
    const known = this.knownFiles.get(sessionId);
    return known ? known.size : 0;
  }

  /**
   * Check if a session is being watched
   * @param {string} sessionId
   * @returns {boolean}
   */
  isWatching(sessionId) {
    return this.watchers.has(sessionId);
  }

  /**
   * Stop all watchers (for graceful shutdown)
   */
  async stopAll() {
    const promises = [];
    for (const sessionId of this.watchers.keys()) {
      promises.push(this.stop(sessionId));
    }
    await Promise.all(promises);
    logger.info('[LiveWatcher] All watchers stopped');
  }
}

// Singleton
let instance = null;

const getLiveWatcher = () => {
  if (!instance) {
    instance = new LiveWatcher();
  }
  return instance;
};

module.exports = { LiveWatcher, getLiveWatcher };
