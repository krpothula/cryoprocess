import { useEffect, useRef } from 'react';
import wsNotifier from '../services/wsNotifier';

/**
 * Hook that triggers a callback when ANY job_update arrives for the project.
 * Used by the job list (Meta) and job tree to get real-time status updates
 * through the shared wsNotifier singleton.
 *
 * @param {string} projectId - The project to subscribe to
 * @param {Function} onUpdate - Called with { id, status, oldStatus, newStatus, ... }
 */
const useProjectNotification = (projectId, onUpdate) => {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  // Ensure WebSocket is connected to the current project
  useEffect(() => {
    if (projectId) {
      wsNotifier.connect(projectId);
    }
  }, [projectId]);

  // Subscribe to project-level updates
  useEffect(() => {
    const handler = (data) => {
      if (callbackRef.current) callbackRef.current(data);
    };

    wsNotifier.subscribeProject(handler);
    return () => wsNotifier.unsubscribeProject(handler);
  }, []);
};

export default useProjectNotification;
