/**
 * Webhook Service
 *
 * Sends notifications to Slack and Microsoft Teams via incoming webhooks.
 * Singleton pattern matching emailService.js.
 */

const https = require('https');
const http = require('http');
const logger = require('../utils/logger');

class WebhookService {
  constructor() {
    this.enabled = true;
  }

  /**
   * Detect webhook type from URL.
   */
  _getType(url) {
    if (url.includes('hooks.slack.com') || url.includes('slack.com/api')) return 'slack';
    if (url.includes('webhook.office.com') || url.includes('outlook.office.com')) return 'teams';
    return 'slack'; // default to Slack format
  }

  /**
   * Build Slack message payload.
   */
  _buildSlackPayload({ jobName, jobType, projectName, status, errorMessage, duration }) {
    const isSuccess = status === 'success';
    const emoji = isSuccess ? ':white_check_mark:' : ':x:';
    const color = isSuccess ? '#10b981' : '#ef4444';
    const statusText = isSuccess ? 'Completed' : 'Failed';

    const fields = [
      { title: 'Project', value: projectName, short: true },
      { title: 'Job Type', value: jobType, short: true },
    ];

    if (duration) {
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durationStr = mins > 60
        ? `${Math.floor(mins / 60)}h ${mins % 60}m`
        : `${mins}m ${secs}s`;
      fields.push({ title: 'Duration', value: durationStr, short: true });
    }

    if (errorMessage) {
      fields.push({ title: 'Error', value: errorMessage.slice(0, 200), short: false });
    }

    return {
      text: `${emoji} *${jobName}* (${jobType}) ${statusText}`,
      attachments: [{
        color,
        fields,
        footer: 'CryoProcess',
        ts: Math.floor(Date.now() / 1000),
      }],
    };
  }

  /**
   * Build Microsoft Teams message payload.
   */
  _buildTeamsPayload({ jobName, jobType, projectName, status, errorMessage, duration }) {
    const isSuccess = status === 'success';
    const color = isSuccess ? '10b981' : 'ef4444';
    const statusText = isSuccess ? 'Completed' : 'Failed';

    const facts = [
      { name: 'Project', value: projectName },
      { name: 'Job Type', value: jobType },
      { name: 'Status', value: statusText },
    ];

    if (duration) {
      const mins = Math.floor(duration / 60);
      const durationStr = mins > 60
        ? `${Math.floor(mins / 60)}h ${mins % 60}m`
        : `${mins}m ${duration % 60}s`;
      facts.push({ name: 'Duration', value: durationStr });
    }

    if (errorMessage) {
      facts.push({ name: 'Error', value: errorMessage.slice(0, 200) });
    }

    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: color,
      summary: `${jobName} ${statusText}`,
      sections: [{
        activityTitle: `${jobName} (${jobType}) ${statusText}`,
        facts,
      }],
    };
  }

  /**
   * POST JSON to a webhook URL.
   */
  _post(url, payload) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;
      const data = JSON.stringify(payload);

      const req = transport.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 10000,
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`Webhook returned ${res.statusCode}: ${body.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Webhook request timed out')); });
      req.write(data);
      req.end();
    });
  }

  /**
   * Send a job notification to a webhook URL.
   */
  async send(webhookUrl, details) {
    const type = this._getType(webhookUrl);
    const payload = type === 'teams'
      ? this._buildTeamsPayload(details)
      : this._buildSlackPayload(details);

    await this._post(webhookUrl, payload);
    logger.info(`[Webhook] Sent ${type} notification to ${webhookUrl.slice(0, 40)}...`);
  }
}

let instance = null;

function getWebhookService() {
  if (!instance) {
    instance = new WebhookService();
  }
  return instance;
}

module.exports = { getWebhookService };
