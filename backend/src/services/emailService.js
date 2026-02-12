/**
 * Email Notification Service
 *
 * Sends email notifications when jobs complete or fail.
 * Uses nodemailer with SMTP configuration from environment variables.
 * Singleton pattern matching getMonitor() / getWebSocketServer().
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const settings = require('../config/settings');

class EmailService {
  constructor() {
    this.transporter = null;
    this.enabled = false;
  }

  /**
   * Initialize the SMTP transporter.
   * Called once at server startup. If SMTP is not configured, the service
   * stays disabled and all send calls are silent no-ops.
   */
  initialize() {
    if (!settings.EMAIL_NOTIFICATIONS_ENABLED) {
      logger.info('[Email] Notifications disabled (EMAIL_NOTIFICATIONS_ENABLED != true)');
      return;
    }

    if (!settings.SMTP_HOST) {
      logger.warn('[Email] SMTP_HOST not configured, email notifications disabled');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: settings.SMTP_HOST,
      port: settings.SMTP_PORT,
      secure: settings.SMTP_SECURE,
      auth: (settings.SMTP_USER && settings.SMTP_PASS) ? {
        user: settings.SMTP_USER,
        pass: settings.SMTP_PASS
      } : undefined
    });

    this.enabled = true;
    logger.info(`[Email] Service initialized (host: ${settings.SMTP_HOST}:${settings.SMTP_PORT})`);

    // Verify connection on startup (non-blocking)
    this.transporter.verify()
      .then(() => logger.info('[Email] SMTP connection verified'))
      .catch((err) => logger.warn(`[Email] SMTP verification failed: ${err.message}`));
  }

  /**
   * Send a job notification email.
   * @param {Object} options
   * @param {string} options.to - Recipient email address
   * @param {string} options.jobName - Human-readable job name (e.g., "Job003")
   * @param {string} options.jobType - RELION job type (e.g., "Class2D")
   * @param {string} options.projectName - Project name
   * @param {string} options.status - 'success' or 'failed'
   * @param {string|null} options.errorMessage - Error message (for failed jobs)
   * @param {number|null} options.duration - Job duration in seconds
   */
  async sendJobNotification({ to, jobName, jobType, projectName, status, errorMessage, duration }) {
    if (!this.enabled || !this.transporter) return;

    const isSuccess = status === 'success';
    const statusLabel = isSuccess ? 'Completed' : 'Failed';
    const subject = `${jobName} (${jobType}) ${statusLabel} - ${projectName}`;

    const durationStr = duration
      ? `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m ${duration % 60}s`
      : 'N/A';

    const textBody = [
      `Job ${statusLabel}: ${jobName}`,
      '',
      `Project: ${projectName}`,
      `Job Type: ${jobType}`,
      `Status: ${statusLabel}`,
      `Duration: ${durationStr}`,
      errorMessage ? `Error: ${errorMessage}` : null,
      '',
      '-- CryoProcess'
    ].filter(Boolean).join('\n');

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="padding: 20px; background: ${isSuccess ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${isSuccess ? '#22c55e' : '#ef4444'}; border-radius: 4px;">
          <h2 style="margin: 0 0 12px; font-size: 16px; color: #111;">
            ${jobName} (${jobType}) ${statusLabel}
          </h2>
          <table style="font-size: 14px; color: #333; border-collapse: collapse;">
            <tr><td style="padding: 4px 12px 4px 0; color: #666;">Project</td><td>${projectName}</td></tr>
            <tr><td style="padding: 4px 12px 4px 0; color: #666;">Duration</td><td>${durationStr}</td></tr>
            ${errorMessage ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;">Error</td><td style="color: #dc2626;">${errorMessage}</td></tr>` : ''}
          </table>
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 16px;">CryoProcess Notification</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: settings.SMTP_FROM,
        to,
        subject,
        text: textBody,
        html: htmlBody
      });
      logger.info(`[Email] Notification sent to ${to} for ${jobName} (${status})`);
    } catch (err) {
      logger.error(`[Email] Failed to send to ${to}: ${err.message}`);
    }
  }
}

// Singleton
let emailServiceInstance = null;

const getEmailService = () => {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
};

module.exports = { EmailService, getEmailService };
