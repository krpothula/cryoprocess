import { useEffect, useRef } from 'react';
import { useBuilder } from '../context/BuilderContext';
import wsNotifier from '../services/wsNotifier';

/**
 * Hook that triggers a callback when the backend pushes a job_update
 * via WebSocket. Used alongside existing polling — does NOT replace
 * polling, just supplements it for instant status-change detection.
 *
 * @param {string} jobId - The job ID to listen for
 * @param {Function} onUpdate - Called (with no args) when a job_update arrives
 */
const useJobNotification = (jobId, onUpdate) => {
  const { projectId } = useBuilder();

  // Keep a stable ref so the handler never changes identity
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  // Ensure WebSocket is connected to the current project
  useEffect(() => {
    if (projectId) {
      wsNotifier.connect(projectId);
    }
  }, [projectId]);

  // Subscribe to updates for this specific job
  useEffect(() => {
    if (!jobId) return;

    const handler = () => {
      if (callbackRef.current) callbackRef.current();
    };

    wsNotifier.subscribe(jobId, handler);
    return () => wsNotifier.unsubscribe(jobId, handler);
  }, [jobId]);
};

export default useJobNotification;
