/**
 * Singleton WebSocket notification service.
 *
 * Maintains ONE shared WebSocket connection and dispatches job_update
 * messages to registered per-job callbacks. Dashboards subscribe via
 * the useJobNotification hook.
 */

class WsNotifier {
  constructor() {
    this.ws = null;
    this.listeners = new Map(); // jobId -> Set<callback>
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

    const wsUrl = `ws://${window.location.hostname}:8001/ws`;
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
            const callbacks = this.listeners.get(data.id);
            if (callbacks) {
              for (const cb of callbacks) {
                try { cb(); } catch (_) { /* dashboard callback error */ }
              }
            }
          }
        } catch (_) { /* non-JSON message */ }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.reconnectTimer = setTimeout(() => this._connect(), 5000);
      };

      this.ws.onerror = () => {};
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
   * Remove a previously registered callback.
   */
  unsubscribe(jobId, callback) {
    const set = this.listeners.get(jobId);
    if (set) {
      set.delete(callback);
      if (set.size === 0) this.listeners.delete(jobId);
    }
  }
}

const wsNotifier = new WsNotifier();
export default wsNotifier;
