/**
 * Webhook Notifier
 *
 * Listens to slurmMonitor statusChange events and sends webhook
 * notifications to project-configured Slack/Teams channels.
 *
 * Follows the same pattern as emailNotifier.js.
 */

const logger = require('../utils/logger');
const { getWebhookService } = require('./webhookService');

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

  try {
    const Project = require('../models/Project');
    const project = await Project.findOne({ id: projectId }).lean();

    if (!project || !project.webhook_urls || project.webhook_urls.length === 0) {
      return;
    }

    const Job = require('../models/Job');
    const job = await Job.findOne({ id: jobId }).lean();
    if (!job) {
      logger.warn(`[WebhookNotifier] Job ${jobId} not found`);
      return;
    }

    const projectName = project.project_name || projectId;

    // Calculate duration
    let duration = null;
    if (job.start_time && job.end_time) {
      duration = Math.round((new Date(job.end_time) - new Date(job.start_time)) / 1000);
    }

    const details = {
      jobName: job.job_name,
      jobType: job.job_type,
      projectName,
      status: newStatus,
      errorMessage: job.error_message || null,
      duration,
    };

    // Send to all configured webhooks in background
    const webhookService = getWebhookService();
    for (const url of project.webhook_urls) {
      setImmediate(async () => {
        try {
          await webhookService.send(url, details);
        } catch (err) {
          logger.error(`[WebhookNotifier] Failed for ${jobId} to ${url.slice(0, 40)}: ${err.message}`);
        }
      });
    }
  } catch (error) {
    logger.error(`[WebhookNotifier] Error handling status change: ${error.message}`);
  }
};

module.exports = { onJobStatusChange };
