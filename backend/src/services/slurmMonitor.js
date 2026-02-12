/**
 * SLURM Monitoring Service
 *
 * Polls SLURM for job status updates and checks RELION marker files.
 */

const { execCommand } = require('../utils/remoteExec');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const Job = require('../models/Job');
const { sanitizeSlurmJobId } = require('../utils/security');
const { storeJobMetadata } = require('../utils/pipelineMetadata');
const EventEmitter = require('events');

class SlurmMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.pollInterval = options.pollInterval || 5000; // 5 seconds default
    this.isRunning = false;
    this.timer = null;
    this.sacctCommand = options.sacctCommand || 'sacct';
    this.squeueCommand = options.squeueCommand || 'squeue';

    // Orphan detection: track consecutive polls where SLURM has no info for a job
    // After maxMissedPolls consecutive misses, mark the job as failed
    this.missedPollCounts = new Map(); // slurmJobId -> consecutive miss count
    this.maxMissedPolls = options.maxMissedPolls || 60; // ~10 min at 10s interval
  }

  start() {
    if (this.isRunning) {
      logger.warn('[SlurmMonitor] Already running');
      return;
    }

    logger.info(`[SlurmMonitor] Starting with ${this.pollInterval}ms poll interval`);
    this.isRunning = true;
    this.poll();
  }

  stop() {
    if (!this.isRunning) return;

    logger.info('[SlurmMonitor] Stopping');
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.missedPollCounts.clear();
  }

  async poll() {
    if (!this.isRunning) return;

    try {
      await this.checkRunningJobs();
    } catch (error) {
      logger.error(`[SlurmMonitor] Poll error: ${error.message}`);
    }

    this.timer = setTimeout(() => this.poll(), this.pollInterval);
  }

  async checkRunningJobs() {
    const activeJobs = await Job.find({
      status: { $in: ['running', 'pending'] },
      slurm_job_id: { $ne: null, $exists: true }
    }).lean();

    if (activeJobs.length === 0) return;

    logger.debug(`[SlurmMonitor] Checking ${activeJobs.length} active jobs`);

    const slurmIds = [...new Set(activeJobs.map(j => j.slurm_job_id).filter(Boolean))];
    const statusMap = await this.getSlurmJobStatuses(slurmIds);

    for (const job of activeJobs) {
      // Check RELION marker files first (more reliable)
      if (job.output_file_path) {
        const successMarker = path.join(job.output_file_path, 'RELION_JOB_EXIT_SUCCESS');
        const failureMarker = path.join(job.output_file_path, 'RELION_JOB_EXIT_FAILURE');

        if (fs.existsSync(successMarker)) {
          await this.updateJobStatus(job, { state: 'success', rawState: 'RELION_SUCCESS', source: 'file' });
          continue;
        }

        if (fs.existsSync(failureMarker)) {
          await this.updateJobStatus(job, { state: 'failed', rawState: 'RELION_FAILURE', source: 'file' });
          continue;
        }
      }

      // Fall back to SLURM status
      const slurmStatus = statusMap[job.slurm_job_id];
      if (slurmStatus) {
        await this.updateJobStatus(job, slurmStatus);
        // Reset missed poll counter - SLURM knows about this job
        this.missedPollCounts.delete(job.slurm_job_id);
      } else {
        // SLURM has no info for this job (not in squeue or sacct)
        // Track consecutive misses to detect orphaned/ghost jobs
        const missCount = (this.missedPollCounts.get(job.slurm_job_id) || 0) + 1;
        this.missedPollCounts.set(job.slurm_job_id, missCount);

        if (missCount >= this.maxMissedPolls) {
          // Before marking as ghost, do one final check for RELION marker files
          // The job may have completed between polls and SLURM already purged it
          if (job.output_file_path) {
            const lateSuccess = path.join(job.output_file_path, 'RELION_JOB_EXIT_SUCCESS');
            const lateFailure = path.join(job.output_file_path, 'RELION_JOB_EXIT_FAILURE');
            if (fs.existsSync(lateSuccess)) {
              logger.info(`[SlurmMonitor] Job ${job.id} (SLURM ${job.slurm_job_id}) - SLURM lost it but RELION marker found: SUCCESS`);
              await this.updateJobStatus(job, { state: 'success', rawState: 'RELION_SUCCESS', source: 'file' });
              this.missedPollCounts.delete(job.slurm_job_id);
              continue;
            }
            if (fs.existsSync(lateFailure)) {
              logger.info(`[SlurmMonitor] Job ${job.id} (SLURM ${job.slurm_job_id}) - SLURM lost it but RELION marker found: FAILURE`);
              await this.updateJobStatus(job, { state: 'failed', rawState: 'RELION_FAILURE', source: 'file' });
              this.missedPollCounts.delete(job.slurm_job_id);
              continue;
            }
          }

          logger.warn(`[SlurmMonitor] Ghost job detected: ${job.id} (SLURM ${job.slurm_job_id}) - no SLURM response for ${missCount} consecutive polls, marking as failed`);
          await this.updateJobStatus(job, {
            state: 'failed',
            rawState: 'GHOST_JOB',
            source: 'orphan_detection'
          });
          this.missedPollCounts.delete(job.slurm_job_id);
        } else if (missCount === 5) {
          // Early warning at 5 misses
          logger.warn(`[SlurmMonitor] Job ${job.id} (SLURM ${job.slurm_job_id}) not found in squeue/sacct for ${missCount} polls`);
        }
      }
    }

    // Prune stale entries from missedPollCounts for jobs no longer active
    if (this.missedPollCounts.size > 0) {
      const activeSlurmIds = new Set(activeJobs.map(j => j.slurm_job_id));
      for (const slurmId of this.missedPollCounts.keys()) {
        if (!activeSlurmIds.has(slurmId)) {
          this.missedPollCounts.delete(slurmId);
        }
      }
    }
  }

  async getSlurmJobStatuses(slurmIds) {
    const statusMap = {};
    if (slurmIds.length === 0) return statusMap;

    try {
      Object.assign(statusMap, await this.querySqueue(slurmIds));
    } catch (error) {
      logger.debug(`[SlurmMonitor] squeue failed: ${error.message}`);
    }

    const missingIds = slurmIds.filter(id => !statusMap[id]);
    if (missingIds.length > 0) {
      try {
        Object.assign(statusMap, await this.querySacct(missingIds));
      } catch (error) {
        logger.debug(`[SlurmMonitor] sacct failed: ${error.message}`);
      }
    }

    return statusMap;
  }

  querySqueue(slurmIds) {
    return new Promise((resolve) => {
      // Sanitize all SLURM job IDs
      const safeIds = slurmIds.map(id => sanitizeSlurmJobId(id)).filter(Boolean);
      if (safeIds.length === 0) {
        resolve({});
        return;
      }

      const args = ['-j', safeIds.join(','), '--format=%i|%t|%M|%L', '--noheader'];

      execCommand(this.squeueCommand, args)
        .then(({ stdout }) => {
          const statusMap = {};
          for (const line of stdout.trim().split('\n').filter(l => l)) {
            const [jobId, state, elapsed, remaining] = line.split('|').map(s => s.trim());
            if (jobId && state) {
              statusMap[jobId] = {
                state: this.mapSqueueState(state),
                rawState: state, elapsed, remaining, source: 'squeue'
              };
            }
          }
          resolve(statusMap);
        })
        .catch(() => resolve({}));
    });
  }

  querySacct(slurmIds) {
    return new Promise((resolve) => {
      // Sanitize all SLURM job IDs
      const safeIds = slurmIds.map(id => sanitizeSlurmJobId(id)).filter(Boolean);
      if (safeIds.length === 0) {
        resolve({});
        return;
      }

      const args = ['-j', safeIds.join(','), '--format=JobID,State,ExitCode,Elapsed', '--noheader', '--parsable2'];

      execCommand(this.sacctCommand, args)
        .then(({ stdout }) => {
          const statusMap = {};
          for (const line of stdout.trim().split('\n').filter(l => l)) {
            const parts = line.split('|');
            if (parts.length >= 4) {
              const [jobId, state, exitCode, elapsed] = parts;
              if (jobId && !jobId.includes('.')) {
                statusMap[jobId] = {
                  state: this.mapSacctState(state),
                  rawState: state, exitCode, elapsed, source: 'sacct'
                };
              }
            }
          }
          resolve(statusMap);
        })
        .catch(() => resolve({}));
    });
  }

  mapSqueueState(state) {
    const map = {
      'PD': 'pending', 'R': 'running', 'CG': 'running', 'CF': 'pending',
      'S': 'running', 'ST': 'running', 'CA': 'cancelled', 'CD': 'success',
      'F': 'failed', 'TO': 'failed', 'NF': 'failed', 'OOM': 'failed',
      'PR': 'failed', 'BF': 'failed'
    };
    const mapped = map[state];
    if (!mapped) {
      logger.warn(`[SlurmMonitor] Unknown squeue state "${state}", treating as failed`);
    }
    return mapped || 'failed';
  }

  mapSacctState(state) {
    const baseState = state.split(' ')[0].toUpperCase();
    const map = {
      'PENDING': 'pending', 'RUNNING': 'running', 'SUSPENDED': 'running',
      'COMPLETING': 'running', 'COMPLETED': 'success', 'CANCELLED': 'cancelled',
      'FAILED': 'failed', 'TIMEOUT': 'failed', 'NODE_FAIL': 'failed',
      'PREEMPTED': 'failed', 'BOOT_FAIL': 'failed', 'OUT_OF_MEMORY': 'failed',
      'DEADLINE': 'failed'
    };
    const mapped = map[baseState];
    if (!mapped) {
      logger.warn(`[SlurmMonitor] Unknown sacct state "${state}", treating as failed`);
    }
    return mapped || 'failed';
  }

  async updateJobStatus(job, slurmStatus) {
    const newStatus = slurmStatus.state;
    const currentStatus = job.status;

    if (newStatus === currentStatus) return;
    if (['success', 'failed', 'cancelled'].includes(currentStatus)) return;

    logger.info(`[SlurmMonitor] Job ${job.id}: ${currentStatus} -> ${newStatus} (${slurmStatus.source})`);

    const updateData = { status: newStatus, updated_at: new Date() };

    if (['success', 'failed', 'cancelled'].includes(newStatus)) {
      updateData.end_time = new Date();
      if (newStatus === 'failed') {
        updateData.error_message = `Job ${slurmStatus.rawState}`;
        if (slurmStatus.exitCode && slurmStatus.exitCode !== '0:0') {
          updateData.error_message += ` (exit: ${slurmStatus.exitCode})`;
        }

        // Enrich with RELION error summary from log files
        if (job.output_file_path) {
          try {
            const { parseRelionErrors, buildErrorSummary } = require('../utils/relionLogParser');
            const outputDir = path.isAbsolute(job.output_file_path)
              ? job.output_file_path
              : job.output_file_path; // relative paths resolved at read time
            const { issues } = parseRelionErrors(outputDir);
            const summary = buildErrorSummary(issues);
            if (summary) {
              updateData.error_message += ` — ${summary}`;
            }
          } catch (parseErr) {
            logger.debug(`[SlurmMonitor] Could not parse RELION logs for ${job.id}: ${parseErr.message}`);
          }
        }
      }
    }

    await Job.findOneAndUpdate({ id: job.id }, updateData);

    // Store pipeline metadata when job completes successfully
    if (newStatus === 'success') {
      try {
        await storeJobMetadata(job.id);
      } catch (metaError) {
        logger.error(`[SlurmMonitor] Failed to store pipeline metadata for ${job.id}: ${metaError.message}`);
      }
    }

    this.emit('statusChange', {
      jobId: job.id,
      projectId: job.project_id,
      oldStatus: currentStatus,
      newStatus,
      slurmStatus
    });
  }

  async getQueueStatus() {
    return new Promise((resolve) => {
      const args = ['--format=%P|%t', '--noheader'];

      execCommand(this.squeueCommand, args)
        .then(({ stdout }) => {
          const partitions = {};
          let total = 0;

          for (const line of stdout.trim().split('\n').filter(l => l)) {
            const [partition, state] = line.split('|').map(s => s.trim());
            if (partition) {
              if (!partitions[partition]) partitions[partition] = { running: 0, pending: 0, total: 0 };
              partitions[partition].total++;
              total++;
              if (state === 'R') partitions[partition].running++;
              else if (state === 'PD') partitions[partition].pending++;
            }
          }
          resolve({ partitions, total });
        })
        .catch(() => resolve({ partitions: {}, total: 0 }));
    });
  }

  cancelJob(slurmJobId) {
    return new Promise((resolve) => {
      const safeJobId = sanitizeSlurmJobId(slurmJobId);
      if (!safeJobId) {
        logger.warn(`[SlurmMonitor] Invalid job ID for cancel: ${slurmJobId}`);
        resolve(false);
        return;
      }

      execCommand('scancel', [safeJobId])
        .then(() => {
          logger.info(`[SlurmMonitor] Cancelled SLURM job ${safeJobId}`);
          resolve(true);
        })
        .catch((error) => {
          logger.error(`[SlurmMonitor] Failed to cancel ${safeJobId}: ${error.message}`);
          resolve(false);
        });
    });
  }

  async getJobDetails(slurmJobId) {
    return new Promise((resolve) => {
      const safeJobId = sanitizeSlurmJobId(slurmJobId);
      if (!safeJobId) {
        resolve(null);
        return;
      }

      const args = ['-j', safeJobId, '--format=JobID,JobName,State,ExitCode,Elapsed,MaxRSS,MaxVMSize,NCPUS,NNodes', '--parsable2', '--noheader'];

      execCommand(this.sacctCommand, args)
        .then(({ stdout }) => {
          if (!stdout.trim()) { resolve(null); return; }

          const mainLine = stdout.trim().split('\n').find(l => !l.split('|')[0].includes('.'));
          if (!mainLine) { resolve(null); return; }

          const p = mainLine.split('|');
          resolve({
            jobId: p[0], jobName: p[1], state: p[2], exitCode: p[3],
            elapsed: p[4], maxRSS: p[5], maxVMSize: p[6], ncpus: p[7], nnodes: p[8]
          });
        })
        .catch(() => resolve(null));
    });
  }
}

let monitorInstance = null;

const getMonitor = (options = {}) => {
  if (!monitorInstance) {
    monitorInstance = new SlurmMonitor(options);
  }
  return monitorInstance;
};

module.exports = { SlurmMonitor, getMonitor };
