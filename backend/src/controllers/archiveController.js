/**
 * Archive Controller
 *
 * Handles project archive, restore, and relocate operations.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const logger = require('../utils/logger');
const Project = require('../models/Project');
const Job = require('../models/Job');
const settings = require('../config/settings');
const response = require('../utils/responseHelper');
const { ACTIVE_STATUSES } = require('../config/constants');
const { getProjectPath, getArchivedProjectPath, rewriteJobPaths } = require('../utils/pathUtils');

// 1 hour timeout for cross-device moves over blobfuse
const MOVE_TIMEOUT = 3600000;

/**
 * Archive a project (move from ROOT_PATH to ARCHIVE_PATH)
 * PUT /api/projects/:projectId/archive
 */
exports.archiveProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!settings.ARCHIVE_PATH) {
      return response.badRequest(res, 'Archive storage is not configured. Set ARCHIVE_PATH in .env');
    }

    const project = await Project.findOne({ id: projectId });
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Only owner or superuser can archive
    if (project.created_by_id !== req.user.id && !req.user.isSuperuser) {
      return response.forbidden(res, 'Only project owner or superuser can archive');
    }

    if (project.is_archived) {
      return response.badRequest(res, 'Project is already archived');
    }

    // Reject if any jobs are still running or pending
    const activeJobs = await Job.countDocuments({
      project_id: projectId,
      status: { $in: ACTIVE_STATUSES }
    });
    if (activeJobs > 0) {
      return response.badRequest(res, `Cannot archive: ${activeJobs} job(s) are still running or pending`);
    }

    const sourcePath = getProjectPath(project);
    const destPath = getArchivedProjectPath(project);

    if (!fs.existsSync(sourcePath)) {
      return response.badRequest(res, `Project folder not found: ${sourcePath}`);
    }

    // Ensure archive parent directory exists
    const destParent = path.dirname(destPath);
    if (!fs.existsSync(destParent)) {
      fs.mkdirSync(destParent, { recursive: true });
    }

    if (fs.existsSync(destPath)) {
      return response.conflict(res, 'Archive destination already exists');
    }

    logger.info(`[Archive] Moving project ${projectId}: ${sourcePath} -> ${destPath}`);

    // Return 202 immediately — move may take time for large projects over blobfuse
    response.success(res, {
      status: 'archiving',
      message: 'Archive started. Project will be marked as archived when complete.'
    }, 202);

    // Perform the move asynchronously (shell mv handles cross-device transparently)
    try {
      execFileSync('mv', [sourcePath, destPath], { timeout: MOVE_TIMEOUT });

      project.is_archived = true;
      await project.save();

      const jobsUpdated = await rewriteJobPaths(projectId, sourcePath, destPath);
      logger.info(`[Archive] Project ${projectId} archived successfully. ${jobsUpdated} job paths updated.`);
    } catch (moveError) {
      logger.error(`[Archive] Failed to archive project ${projectId}: ${moveError.message}`);
      // Project remains is_archived=false so user can retry
    }
  } catch (error) {
    logger.error('[Archive] archiveProject error:', error);
    if (!res.headersSent) {
      return response.serverError(res, error.message);
    }
  }
};

/**
 * Restore an archived project (move from ARCHIVE_PATH back to ROOT_PATH)
 * PUT /api/projects/:projectId/restore
 */
exports.restoreProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!settings.ARCHIVE_PATH) {
      return response.badRequest(res, 'Archive storage is not configured. Set ARCHIVE_PATH in .env');
    }

    const project = await Project.findOne({ id: projectId });
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Only owner or superuser can restore
    if (project.created_by_id !== req.user.id && !req.user.isSuperuser) {
      return response.forbidden(res, 'Only project owner or superuser can restore');
    }

    if (!project.is_archived) {
      return response.badRequest(res, 'Project is not archived');
    }

    const sourcePath = getArchivedProjectPath(project);
    const destPath = getProjectPath(project);

    if (!fs.existsSync(sourcePath)) {
      return response.badRequest(res, `Archived project folder not found: ${sourcePath}`);
    }

    if (fs.existsSync(destPath)) {
      return response.conflict(res, 'Active project folder already exists at destination');
    }

    logger.info(`[Archive] Restoring project ${projectId}: ${sourcePath} -> ${destPath}`);

    response.success(res, {
      status: 'restoring',
      message: 'Restore started. Project will be marked as active when complete.'
    }, 202);

    try {
      execFileSync('mv', [sourcePath, destPath], { timeout: MOVE_TIMEOUT });

      project.is_archived = false;
      await project.save();

      const jobsUpdated = await rewriteJobPaths(projectId, sourcePath, destPath);
      logger.info(`[Archive] Project ${projectId} restored successfully. ${jobsUpdated} job paths updated.`);
    } catch (moveError) {
      logger.error(`[Archive] Failed to restore project ${projectId}: ${moveError.message}`);
    }
  } catch (error) {
    logger.error('[Archive] restoreProject error:', error);
    if (!res.headersSent) {
      return response.serverError(res, error.message);
    }
  }
};

/**
 * Relocate a project to a new path (for manual moves)
 * PUT /api/projects/:projectId/relocate
 */
exports.relocateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { newPath } = req.body;

    if (!newPath || !path.isAbsolute(newPath)) {
      return response.badRequest(res, 'newPath must be an absolute path');
    }

    // Superuser only
    if (!req.user.isSuperuser) {
      return response.forbidden(res, 'Only superusers can relocate projects');
    }

    const project = await Project.findOne({ id: projectId });
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    if (!fs.existsSync(newPath)) {
      return response.badRequest(res, `Path does not exist: ${newPath}`);
    }

    // Compute old path based on current state
    const oldPath = project.is_archived
      ? getArchivedProjectPath(project)
      : getProjectPath(project);

    // Derive new folder_name and archive status from the newPath
    const newFolderName = path.basename(newPath);
    let newIsArchived = project.is_archived;

    if (newPath.startsWith(settings.ROOT_PATH + path.sep)) {
      newIsArchived = false;
    } else if (settings.ARCHIVE_PATH && newPath.startsWith(settings.ARCHIVE_PATH + path.sep)) {
      newIsArchived = true;
    }

    project.folder_name = newFolderName;
    project.is_archived = newIsArchived;
    await project.save();

    const jobsUpdated = await rewriteJobPaths(projectId, oldPath, newPath);

    logger.info(`[Relocate] Project ${projectId} relocated: ${oldPath} -> ${newPath}. ${jobsUpdated} jobs updated.`);

    return response.success(res, {
      message: `Project relocated. ${jobsUpdated} job paths updated.`,
      data: { folderName: newFolderName, isArchived: newIsArchived }
    });
  } catch (error) {
    logger.error('[Relocate] Error:', error);
    return response.serverError(res, error.message);
  }
};
