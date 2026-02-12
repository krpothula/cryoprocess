/**
 * Email Notifier
 *
 * Listens to slurmMonitor statusChange events and sends email
 * notifications to the job owner when jobs complete or fail.
 *
 * Follows the same pattern as thumbnailGenerator.onJobStatusChange.
 */

const logger = require('../utils/logger');
const { getEmailService } = require('./emailService');

/**
 * Handle job status change event from SlurmMonitor.
 * @param {Object} event - { jobId, projectId, oldStatus, newStatus, slurmStatus }
 */
const onJobStatusChange = async (event) => {
  const { jobId, projectId, newStatus } = event;

  // Only notify on terminal states
  if (newStatus !== 'success' && newStatus !== 'failed') {
    return;
  }

  const emailService = getEmailService();
  if (!emailService.enabled) return;

  try {
    const Job = require('../models/Job');
    const job = await Job.findOne({ id: jobId }).lean();

    if (!job) {
      logger.warn(`[EmailNotifier] Job ${jobId} not found`);
      return;
    }

    // Only send if user opted in for this job
    if (!job.notify_email) {
      return;
    }

    const User = require('../models/User');
    const user = await User.findOne({ id: job.user_id }).lean();
    if (!user || !user.email) return;

    const Project = require('../models/Project');
    const project = await Project.findOne({ id: projectId }).lean();
    const projectName = project?.project_name || projectId;

    // Calculate duration
    let duration = null;
    if (job.start_time && job.end_time) {
      duration = Math.round((new Date(job.end_time) - new Date(job.start_time)) / 1000);
    }

    // Send in background (don't block the monitor)
    setImmediate(async () => {
      try {
        await emailService.sendJobNotification({
          to: user.email,
          jobName: job.job_name,
          jobType: job.job_type,
          projectName,
          status: newStatus,
          errorMessage: job.error_message || null,
          duration
        });
      } catch (err) {
        logger.error(`[EmailNotifier] Failed for ${jobId}: ${err.message}`);
      }
    });
  } catch (error) {
    logger.error(`[EmailNotifier] Error handling status change: ${error.message}`);
  }
};

module.exports = { onJobStatusChange };
