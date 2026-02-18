import { useEffect, useRef, useState } from 'react';
import { useBuilder } from '../context/BuilderContext';
import wsNotifier from '../services/wsNotifier';

/**
 * Hook that receives real-time job_progress messages via WebSocket.
 * Returns live progress data (iteration count, micrograph count, etc.)
 * that updates without polling.
 *
 * @param {string} jobId - The job ID to listen for
 * @returns {{ iterationCount: number|null, micrographCount: number|null, particleCount: number|null, progressPercent: number|null }}
 */
const useJobProgress = (jobId) => {
  const { projectId } = useBuilder();
  const [progress, setProgress] = useState(null);

  // Ensure WebSocket is connected to the current project
  useEffect(() => {
    if (projectId) {
      wsNotifier.connect(projectId);
    }
  }, [projectId]);

  // Reset progress when job changes
  useEffect(() => {
    setProgress(null);
  }, [jobId]);

  // Subscribe to progress updates for this specific job
  useEffect(() => {
    if (!jobId) return;

    const handler = (data) => {
      setProgress({
        iterationCount: data.iterationCount,
        micrographCount: data.micrographCount,
        particleCount: data.particleCount,
        totalIterations: data.totalIterations,
        progressPercent: data.progressPercent,
      });
    };

    wsNotifier.subscribeProgress(jobId, handler);
    return () => wsNotifier.unsubscribeProgress(jobId, handler);
  }, [jobId]);

  return progress;
};

export default useJobProgress;
