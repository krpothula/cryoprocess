/**
 * Singleton WebSocket notification service.
 *
 * Maintains ONE shared WebSocket connection and dispatches job_update
 * messages to registered callbacks:
 *   - Per-job callbacks  (subscribe/unsubscribe)       — used by dashboards
 *   - Project-level callbacks (subscribeProject/...)    — used by job list & tree
 */

class WsNotifier {
  constructor() {
    this.ws = null;
    this.listeners = new Map(); // jobId -> Set<callback>
    this.projectListeners = new Set(); // project-level callbacks (any job_update)
    this.projectId = null;
    this.reconnectTimer = null;
    this.connected = false;
  }

  /**
   * Ensure the WebSocket is connected and subscribed to the given project.
   * No-op if already connected to the same project.
   */
  connect(projectId) {
    if (!projectId) return;
    if (this.ws && this.projectId === projectId && this.connected) return;
    this.projectId = projectId;
    this._connect();
  }

  /** @private */
  _connect() {
    // Tear down previous connection
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    clearTimeout(this.reconnectTimer);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = process.env.REACT_APP_WS_HOST || window.location.hostname;
    const wsPort = process.env.REACT_APP_WS_PORT || '8001';
    const wsUrl = `${wsProtocol}://${wsHost}:${wsPort}/ws`;
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        if (this.projectId && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'subscribe',
            project_id: this.projectId
          }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'job_update' && data.id) {
            // Per-job callbacks (dashboards)
            const callbacks = this.listeners.get(data.id);
            if (callbacks) {
              for (const cb of callbacks) {
                try { cb(data); } catch (_) { /* dashboard callback error */ }
              }
            }
            // Project-level callbacks (job list, tree)
            for (const cb of this.projectListeners) {
              try { cb(data); } catch (_) { /* project callback error */ }
            }
          }
        } catch (_) { /* non-JSON message */ }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.reconnectTimer = setTimeout(() => this._connect(), 5000);
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] Connection error — will retry');
      };
    } catch (_) {
      this.reconnectTimer = setTimeout(() => this._connect(), 5000);
    }
  }

  /**
   * Register a callback for job_update messages targeting a specific job.
   */
  subscribe(jobId, callback) {
    if (!jobId || !callback) return;
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    this.listeners.get(jobId).add(callback);
  }

  /**
   * Remove a previously registered per-job callback.
   */
  unsubscribe(jobId, callback) {
    const set = this.listeners.get(jobId);
    if (set) {
      set.delete(callback);
      if (set.size === 0) this.listeners.delete(jobId);
    }
  }

  /**
   * Register a callback for ANY job_update in the project.
   * Callback receives the full message: { id, status, oldStatus, newStatus, ... }
   */
  subscribeProject(callback) {
    if (!callback) return;
    this.projectListeners.add(callback);
  }

  /**
   * Remove a project-level callback.
   */
  unsubscribeProject(callback) {
    this.projectListeners.delete(callback);
  }
}

const wsNotifier = new WsNotifier();
export default wsNotifier;
