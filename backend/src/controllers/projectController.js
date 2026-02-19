/**
 * Project Controller
 *
 * Handles project management operations.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const Project = require('../models/Project');
const ProjectMember = require('../models/ProjectMember');
const Job = require('../models/Job');
const User = require('../models/User');
const LiveSession = require('../models/LiveSession');
const settings = require('../config/settings');
const response = require('../utils/responseHelper');
const auditLog = require('../utils/auditLogger');
const { mapKeys } = require('../utils/mapKeys');
const { checkProjectAccess } = require('./projectMemberController');
const { parsePagination } = require('../utils/pagination');

/**
 * Helper to get user display name
 */
function getUserDisplayName(user) {
  if (!user) return 'Unknown';
  if (user.last_name && user.first_name) {
    return `${user.last_name}, ${user.first_name}`;
  }
  if (user.last_name) return user.last_name;
  if (user.first_name) return user.first_name;
  return user.username;
}

/**
 * Transform a project DB document (.lean() or .toObject()) to camelCase API response
 */
function mapProject(p) {
  if (!p) return p;
  return {
    id: p.id,
    projectName: p.project_name,
    description: p.description,
    folderName: p.folder_name,
    createdById: p.created_by_id,
    creationDate: p.creation_date,
    isArchived: p.is_archived || false,
    webhookUrls: p.webhook_urls || [],
    lastAccessedAt: p.last_accessed_at,
    // Enriched fields (already camelCase from enrichment step)
    role: p.role,
    isOwner: p.isOwner,
    jobCount: p.jobCount,
    createdName: p.createdName,
    liveSessionId: p.liveSessionId,
    liveSessionStatus: p.liveSessionStatus,
  };
}

/**
 * List all projects for current user (owned + shared)
 * Staff and Superusers see ALL projects
 * GET /api/projects
 */
exports.listProjects = async (req, res) => {
  try {
    const { includeArchived = 'false' } = req.query;
    const { limit, skip } = parsePagination(req.query, { maxLimit: 200 });
    const currentUserName = getUserDisplayName(req.user);

    // Staff and Superusers see ALL projects
    if (req.user.isStaff || req.user.isSuperuser) {
      const query = {};
      if (includeArchived !== 'true') {
        query.is_archived = { $ne: true };
      }

      const totalCount = await Project.countDocuments(query);
      const allProjects = await Project.find(query)
        .sort({ creation_date: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      if (allProjects.length === 0) {
        return response.success(res, { data: [], count: totalCount });
      }

      // Batch: Get all job counts in one aggregation
      const projectIds = allProjects.map(p => p.id);
      const jobCounts = await Job.aggregate([
        { $match: { project_id: { $in: projectIds } } },
        { $group: { _id: '$project_id', count: { $sum: 1 } } }
      ]);
      const jobCountMap = Object.fromEntries(jobCounts.map(j => [j._id, j.count]));

      // Batch: Get all unique creator IDs and fetch users
      const creatorIds = [...new Set(allProjects.map(p => p.created_by_id))];
      const creators = await User.find({ id: { $in: creatorIds } }).lean();
      const creatorMap = Object.fromEntries(creators.map(u => [u.id, u]));

      // Batch: Get live sessions for all projects
      const liveSessions = await LiveSession.find(
        { project_id: { $in: projectIds } },
        'id project_id session_name status'
      ).lean();
      const liveSessionMap = Object.fromEntries(liveSessions.map(s => [s.project_id, s]));

      // Enrich projects without N+1 queries
      for (const project of allProjects) {
        project.isOwner = project.created_by_id === req.user.id || req.user.isSuperuser;
        project.role = project.created_by_id === req.user.id ? 'owner' : (req.user.isSuperuser ? 'admin' : 'editor');
        project.jobCount = jobCountMap[project.id] || 0;
        project.createdName = project.created_by_id === req.user.id
          ? currentUserName
          : getUserDisplayName(creatorMap[project.created_by_id]);
        const ls = liveSessionMap[project.id];
        if (ls) {
          project.liveSessionId = ls.id;
          project.liveSessionStatus = ls.status;
        }
      }

      return response.success(res, {
        data: allProjects.map(mapProject),
        count: totalCount
      });
    }

    // Regular users: Get owned projects
    const ownedQuery = { created_by_id: req.user.id };
    if (includeArchived !== 'true') {
      ownedQuery.is_archived = { $ne: true };
    }

    const ownedProjects = await Project.find(ownedQuery)
      .sort({ creation_date: -1 })
      .lean();

    // Get shared projects (where user is a member)
    const memberships = await ProjectMember.find({ user_id: req.user.id }).lean();
    const sharedProjectIds = memberships.map(m => m.project_id);
    const membershipMap = Object.fromEntries(memberships.map(m => [m.project_id, m.role]));

    const sharedQuery = { id: { $in: sharedProjectIds } };
    if (includeArchived !== 'true') {
      sharedQuery.is_archived = { $ne: true };
    }

    const sharedProjects = sharedProjectIds.length > 0
      ? await Project.find(sharedQuery).sort({ creation_date: -1 }).lean()
      : [];

    // Combine all projects for batch queries
    const allProjects = [...ownedProjects, ...sharedProjects];

    if (allProjects.length === 0) {
      return response.success(res, { data: [], count: 0 });
    }

    // Batch: Get all job counts in one aggregation
    const projectIds = allProjects.map(p => p.id);
    const jobCounts = await Job.aggregate([
      { $match: { project_id: { $in: projectIds } } },
      { $group: { _id: '$project_id', count: { $sum: 1 } } }
    ]);
    const jobCountMap = Object.fromEntries(jobCounts.map(j => [j._id, j.count]));

    // Batch: Get all unique creator IDs (excluding current user) and fetch users
    const otherCreatorIds = [...new Set(
      sharedProjects.map(p => p.created_by_id).filter(id => id !== req.user.id)
    )];
    const creators = otherCreatorIds.length > 0
      ? await User.find({ id: { $in: otherCreatorIds } }).lean()
      : [];
    const creatorMap = Object.fromEntries(creators.map(u => [u.id, u]));

    // Batch: Get live sessions for all projects
    const liveSessions = await LiveSession.find(
      { project_id: { $in: projectIds } },
      'id project_id session_name status'
    ).lean();
    const liveSessionMap = Object.fromEntries(liveSessions.map(s => [s.project_id, s]));

    // Enrich owned projects
    for (const project of ownedProjects) {
      project.role = 'owner';
      project.isOwner = true;
      project.jobCount = jobCountMap[project.id] || 0;
      project.createdName = currentUserName;
      const ls = liveSessionMap[project.id];
      if (ls) {
        project.liveSessionId = ls.id;
        project.liveSessionStatus = ls.status;
      }
    }

    // Enrich shared projects
    for (const project of sharedProjects) {
      project.role = membershipMap[project.id] || 'viewer';
      project.isOwner = false;
      project.jobCount = jobCountMap[project.id] || 0;
      project.createdName = getUserDisplayName(creatorMap[project.created_by_id]);
      const ls = liveSessionMap[project.id];
      if (ls) {
        project.liveSessionId = ls.id;
        project.liveSessionStatus = ls.status;
      }
    }

    // Sort combined list by creation date
    allProjects.sort((a, b) => new Date(b.creation_date) - new Date(a.creation_date));

    const totalCount = allProjects.length;
    const paginatedProjects = allProjects.slice(skip, skip + limit);

    return response.success(res, {
      data: paginatedProjects.map(mapProject),
      count: totalCount
    });
  } catch (error) {
    logger.error('[Projects] listProjects error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Create a new project
 * POST /api/projects
 */
exports.createProject = async (req, res) => {
  try {
    const { projectName, description = '', movieDirectory } = req.body;

    if (!projectName || typeof projectName !== 'string') {
      return response.badRequest(res, 'Project name is required');
    }

    // Validate project name
    const trimmedName = projectName.trim();
    if (trimmedName.length === 0) {
      return response.badRequest(res, 'Project name cannot be empty');
    }
    if (trimmedName.length > 255) {
      return response.badRequest(res, 'Project name must be 255 characters or less');
    }
    if (!/^[a-zA-Z0-9 _\-().]+$/.test(trimmedName)) {
      return response.badRequest(res, 'Project name can only contain letters, numbers, spaces, hyphens, underscores, parentheses, and periods');
    }

    // Validate description length
    if (description && description.length > 5000) {
      return response.badRequest(res, 'Description must be 5000 characters or less');
    }

    // Generate folder name from project name with date suffix for uniqueness
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const folderName = `${trimmedName.replace(/ /g, '_')}_${dateStr}`;

    // Check if project folder already exists
    const projectPath = path.join(settings.ROOT_PATH, folderName);
    if (fs.existsSync(projectPath)) {
      return response.conflict(res, 'A project with this name already exists');
    }

    // Validate movie directory before creating anything
    if (movieDirectory) {
      if (!fs.existsSync(movieDirectory)) {
        return response.badRequest(res, `Movie directory does not exist: ${movieDirectory}`, 'path_not_found');
      }
      const stat = fs.statSync(movieDirectory);
      if (!stat.isDirectory()) {
        return response.badRequest(res, 'Movie directory path is not a directory');
      }
    }

    // Create project folder
    fs.mkdirSync(projectPath, { recursive: true, mode: 0o755 });

    // Create symlink to movie directory if provided
    if (movieDirectory) {
      const moviesPath = path.join(projectPath, 'Movies');
      try {
        fs.symlinkSync(movieDirectory, moviesPath);
        logger.info(`[Projects] Created symlink: ${moviesPath} -> ${movieDirectory}`);
      } catch (symlinkErr) {
        // Clean up project folder on symlink failure
        fs.rmSync(projectPath, { recursive: true, force: true });
        logger.error(`[Projects] Symlink failed: ${symlinkErr.message}`);
        return response.badRequest(res, `Failed to link movie directory: ${symlinkErr.message}`);
      }
    }

    // Create project in database
    const projectId = Project.generateId();
    const project = await Project.create({
      id: projectId,
      project_name: projectName,
      description,
      folder_name: folderName,
      created_by_id: req.user.id
    });

    logger.info(`[Projects] Created project: ${projectId} | name: ${projectName}${movieDirectory ? ` | movies: ${movieDirectory}` : ''}`);
    auditLog(req, 'project_create', { resourceType: 'project', resourceId: projectId, details: projectName });

    return response.created(res, { data: mapProject(project.toObject()) });
  } catch (error) {
    logger.error('[Projects] createProject error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get project by ID
 * Superusers can access any project
 * GET /api/projects/:projectId
 */
exports.getProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Check ownership or membership
    const access = await checkProjectAccess(projectId, req.user.id, 'viewer');
    if (!access.hasAccess) {
      return response.forbidden(res);
    }
    const role = access.role;
    const isOwner = role === 'owner' || role === 'admin';

    // Add job count and role info
    project.jobCount = await Job.countDocuments({ project_id: projectId });
    project.role = role;
    project.isOwner = isOwner;

    // Update last accessed
    await Project.findOneAndUpdate(
      { id: projectId },
      { last_accessed_at: new Date() }
    );

    return response.successData(res, mapProject(project));
  } catch (error) {
    logger.error('[Projects] getProject error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Update project
 * PUT /api/projects/:projectId
 * Requires owner, admin role, staff, or superuser
 */
exports.updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { projectName, description } = req.body;

    const project = await Project.findOne({ id: projectId });
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Check ownership, staff, superuser, or admin role
    const access = await checkProjectAccess(projectId, req.user.id, 'admin');
    if (!access.hasAccess) {
      return response.forbidden(res, 'Only project owner or admin can update project');
    }

    // Validate and update fields
    if (projectName) {
      const trimmedName = projectName.trim();
      if (trimmedName.length === 0) {
        return response.badRequest(res, 'Project name cannot be empty');
      }
      if (trimmedName.length > 255) {
        return response.badRequest(res, 'Project name must be 255 characters or less');
      }
      if (!/^[a-zA-Z0-9 _\-().]+$/.test(trimmedName)) {
        return response.badRequest(res, 'Project name can only contain letters, numbers, spaces, hyphens, underscores, parentheses, and periods');
      }
      project.project_name = trimmedName;
    }
    if (description !== undefined) {
      if (description.length > 5000) {
        return response.badRequest(res, 'Description must be 5000 characters or less');
      }
      project.description = description;
    }

    // Webhook URLs
    if (req.body.webhookUrls !== undefined) {
      const urls = req.body.webhookUrls;
      if (!Array.isArray(urls) || urls.length > 5) {
        return response.badRequest(res, 'webhookUrls must be an array of up to 5 URLs');
      }
      for (const url of urls) {
        if (typeof url !== 'string' || !url.startsWith('https://')) {
          return response.badRequest(res, 'Each webhook URL must start with https://');
        }
      }
      project.webhook_urls = urls;
    }

    await project.save();
    auditLog(req, 'project_update', { resourceType: 'project', resourceId: projectId, details: project.project_name });

    return response.successData(res, mapProject(project.toObject()));
  } catch (error) {
    logger.error('[Projects] updateProject error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Delete project (archive)
 * DELETE /api/projects/:projectId
 * Requires owner or superuser
 */
exports.deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findOne({ id: projectId });
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Verify ownership or superuser
    if (project.created_by_id !== req.user.id && !req.user.isSuperuser) {
      return response.forbidden(res);
    }

    // Construct project path from folder_name
    const projectPath = path.join(settings.ROOT_PATH, project.folder_name || project.project_name.replace(/ /g, '_'));
    const projectName = project.project_name;

    // Delete all jobs associated with this project
    const deletedJobs = await Job.deleteMany({ project_id: projectId });
    logger.info(`[Projects] Deleted ${deletedJobs.deletedCount} jobs for project: ${projectId}`);

    // Delete all project members
    const deletedMembers = await ProjectMember.deleteMany({ project_id: projectId });
    logger.info(`[Projects] Deleted ${deletedMembers.deletedCount} members for project: ${projectId}`);

    // Delete the project from database
    await Project.deleteOne({ id: projectId });
    logger.info(`[Projects] Deleted project from database: ${projectId}`);

    // Delete the project folder from filesystem
    if (projectPath && fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
      logger.info(`[Projects] Deleted project folder: ${projectPath}`);
    }

    auditLog(req, 'project_delete', { resourceType: 'project', resourceId: projectId, details: projectName });
    return response.success(res, { message: `Project "${projectName}" deleted successfully` });
  } catch (error) {
    logger.error('[Projects] deleteProject error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get all jobs for a project
 * GET /api/projects/:projectId/jobs
 * Staff/Superusers can access any project
 */
exports.getProjectJobs = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Check ownership, staff/superuser, or membership
    const access = await checkProjectAccess(projectId, req.user.id, 'viewer');
    if (!access.hasAccess) {
      return response.forbidden(res);
    }

    const jobs = await Job.find({ project_id: projectId })
      .sort({ created_at: -1 })
      .lean();

    return response.success(res, {
      data: jobs.map(mapKeys),
      count: jobs.length
    });
  } catch (error) {
    logger.error('[Projects] getProjectJobs error:', error);
    return response.serverError(res, error.message);
  }
};
