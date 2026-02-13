/**
 * Job Status Utilities
 *
 * Single source of truth for job status values and display logic.
 * Backend canonical statuses: pending, running, success, failed, cancelled
 */

// Canonical status values (must match backend JOB_STATUS in constants.js)
export const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

// Terminal statuses — job is done, no more polling needed
export const TERMINAL_STATUSES = [
  JOB_STATUS.SUCCESS,
  JOB_STATUS.FAILED,
  JOB_STATUS.CANCELLED,
];

// Active statuses — job is still in progress
export const ACTIVE_STATUSES = [
  JOB_STATUS.PENDING,
  JOB_STATUS.RUNNING,
];

/**
 * Check if a job status means the job is still active (pending or running)
 */
export const isActiveStatus = (status) =>
  status === JOB_STATUS.PENDING || status === JOB_STATUS.RUNNING;

/**
 * Check if a job status is terminal (done)
 */
export const isTerminalStatus = (status) =>
  TERMINAL_STATUSES.includes(status);

/**
 * Status color for indicator dots, icons, and text.
 * Returns a CSS color string.
 */
export const getStatusColor = (status) => {
  switch (status) {
    case JOB_STATUS.SUCCESS:
      return '#10b981'; // green
    case JOB_STATUS.RUNNING:
    case JOB_STATUS.PENDING:
      return '#f59e0b'; // amber
    case JOB_STATUS.FAILED:
      return '#ef4444'; // red
    case JOB_STATUS.CANCELLED:
      return '#94a3b8'; // gray
    default:
      return '#94a3b8'; // gray
  }
};

/**
 * Status CSS variable color for themed components.
 */
export const getStatusCssVar = (status) => {
  switch (status) {
    case JOB_STATUS.SUCCESS:
      return 'var(--color-success)';
    case JOB_STATUS.RUNNING:
    case JOB_STATUS.PENDING:
      return 'var(--color-warning)';
    case JOB_STATUS.FAILED:
      return 'var(--color-danger)';
    case JOB_STATUS.CANCELLED:
    default:
      return 'var(--color-text-muted)';
  }
};
