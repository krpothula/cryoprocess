/**
 * Project Member Controller
 *
 * Handles project sharing and member management.
 */

const logger = require('../utils/logger');
const Project = require('../models/Project');
const ProjectMember = require('../models/ProjectMember');
const User = require('../models/User');
const response = require('../utils/responseHelper');

/**
 * Check if user has access to project (owner or member)
 */
const checkProjectAccess = async (projectId, userId, requiredRole = 'viewer') => {
  const project = await Project.findOne({ id: projectId }).lean();
  if (!project) {
    return { hasAccess: false, error: 'Project not found', status: 404 };
  }

  // Owner always has full access
  if (project.created_by_id === userId) {
    return { hasAccess: true, project, role: 'owner' };
  }

  // Staff and superusers have access to all projects
  const user = await User.findOne({ id: userId }).lean();
  if (user && user.is_superuser) {
    return { hasAccess: true, project, role: 'admin' };
  }
  if (user && user.is_staff) {
    return { hasAccess: true, project, role: 'editor' };
  }

  // Check membership
  const membership = await ProjectMember.findOne({
    project_id: projectId,
    user_id: userId
  }).lean();

  if (!membership) {
    return { hasAccess: false, error: 'Access denied', status: 403 };
  }

  // Check role level
  if (!ProjectMember.hasRole(membership.role, requiredRole)) {
    return { hasAccess: false, error: 'Insufficient permissions', status: 403 };
  }

  return { hasAccess: true, project, role: membership.role };
};

/**
 * List project members
 * GET /api/projects/:projectId/members
 */
exports.listMembers = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Check access (any member can view member list)
    const access = await checkProjectAccess(projectId, req.user.id, 'viewer');
    if (!access.hasAccess) {
      if (access.status === 404) {
        return response.notFound(res, access.error);
      }
      return response.forbidden(res, access.error);
    }

    // Get all members
    const members = await ProjectMember.find({ project_id: projectId }).lean();

    // Get user details for each member
    const memberDetails = await Promise.all(
      members.map(async (member) => {
        const user = await User.findOne({ id: member.user_id }).lean();
        return {
          id: member.id,
          user_id: member.user_id,
          username: user?.username || 'Unknown',
          email: user?.email || '',
          first_name: user?.first_name || '',
          last_name: user?.last_name || '',
          role: member.role,
          added_at: member.added_at
        };
      })
    );

    // Add owner info
    const owner = await User.findOne({ id: access.project.created_by_id }).lean();
    const ownerInfo = {
      user_id: access.project.created_by_id,
      username: owner?.username || 'Unknown',
      email: owner?.email || '',
      first_name: owner?.first_name || '',
      last_name: owner?.last_name || '',
      role: 'owner',
      is_owner: true
    };

    res.json({
      success: true,
      status: 'success',
      data: {
        owner: ownerInfo,
        members: memberDetails
      }
    });
  } catch (error) {
    logger.error('[ProjectMembers] listMembers error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Add member to project
 * POST /api/projects/:projectId/members
 */
exports.addMember = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { user_id, username, email, role = 'viewer' } = req.body;

    // Check access (need admin role to add members)
    const access = await checkProjectAccess(projectId, req.user.id, 'admin');
    if (!access.hasAccess) {
      // Owner can always add members
      const project = await Project.findOne({ id: projectId }).lean();
      if (!project || project.created_by_id !== req.user.id) {
        return response.forbidden(res, access.error || 'Only project owner or admin can add members');
      }
    }

    // Find user to add
    let userToAdd;
    if (user_id) {
      userToAdd = await User.findOne({ id: user_id }).lean();
    } else if (username) {
      userToAdd = await User.findOne({ username: username.toLowerCase() }).lean();
    } else if (email) {
      userToAdd = await User.findOne({ email: email.toLowerCase() }).lean();
    }

    if (!userToAdd) {
      return response.notFound(res, 'User not found');
    }

    // Check if user is the owner
    const project = await Project.findOne({ id: projectId }).lean();
    if (project.created_by_id === userToAdd.id) {
      return response.badRequest(res, 'Cannot add project owner as a member');
    }

    // Check if already a member
    const existingMember = await ProjectMember.findOne({
      project_id: projectId,
      user_id: userToAdd.id
    });

    if (existingMember) {
      return response.conflict(res, 'User is already a member of this project');
    }

    // Validate role
    if (!['viewer', 'editor', 'admin'].includes(role)) {
      return response.badRequest(res, 'Invalid role. Must be viewer, editor, or admin');
    }

    // Create membership
    const memberId = ProjectMember.generateId();
    const member = await ProjectMember.create({
      id: memberId,
      project_id: projectId,
      user_id: userToAdd.id,
      role,
      added_by: req.user.id
    });

    logger.info(`[ProjectMembers] Added member ${userToAdd.username} to project ${projectId} with role ${role}`);

    res.status(201).json({
      success: true,
      status: 'success',
      data: {
        id: member.id,
        user_id: userToAdd.id,
        username: userToAdd.username,
        email: userToAdd.email,
        first_name: userToAdd.first_name,
        last_name: userToAdd.last_name,
        role: member.role,
        added_at: member.added_at
      }
    });
  } catch (error) {
    logger.error('[ProjectMembers] addMember error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Update member role
 * PUT /api/projects/:projectId/members/:userId
 */
exports.updateMember = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { role } = req.body;

    // Check access (need admin role or be owner)
    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    const isOwner = project.created_by_id === req.user.id;
    if (!isOwner) {
      const access = await checkProjectAccess(projectId, req.user.id, 'admin');
      if (!access.hasAccess) {
        return response.forbidden(res, 'Only project owner or admin can update member roles');
      }
    }

    // Validate role
    if (!['viewer', 'editor', 'admin'].includes(role)) {
      return response.badRequest(res, 'Invalid role. Must be viewer, editor, or admin');
    }

    // Only owners can grant admin role
    if (role === 'admin' && !isOwner) {
      return response.forbidden(res, 'Only the project owner can grant admin role');
    }

    // Find membership
    const member = await ProjectMember.findOne({
      project_id: projectId,
      user_id: parseInt(userId)
    });

    if (!member) {
      return response.notFound(res, 'Member not found');
    }

    // Prevent non-owners from downgrading admins
    if (!isOwner && member.role === 'admin') {
      return response.forbidden(res, 'Only the project owner can change an admin\'s role');
    }

    // Update role
    member.role = role;
    await member.save();

    logger.info(`[ProjectMembers] Updated member ${userId} role to ${role} in project ${projectId}`);

    return response.success(res, {
      id: member.id,
      user_id: member.user_id,
      role: member.role
    });
  } catch (error) {
    logger.error('[ProjectMembers] updateMember error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Remove member from project
 * DELETE /api/projects/:projectId/members/:userId
 */
exports.removeMember = async (req, res) => {
  try {
    const { projectId, userId } = req.params;

    // Check access (need admin role or be owner, or removing self)
    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Cannot remove the project owner
    if (project.created_by_id === parseInt(userId)) {
      return response.badRequest(res, 'Cannot remove the project owner');
    }

    const isOwner = project.created_by_id === req.user.id;
    const isRemovingSelf = req.user.id === parseInt(userId);

    if (!isOwner && !isRemovingSelf) {
      const access = await checkProjectAccess(projectId, req.user.id, 'admin');
      if (!access.hasAccess) {
        return response.forbidden(res, 'Only project owner, admin, or the member themselves can remove membership');
      }

      // Non-owner admins cannot remove other admins
      const targetMember = await ProjectMember.findOne({
        project_id: projectId,
        user_id: parseInt(userId)
      }).lean();
      if (targetMember && targetMember.role === 'admin') {
        return response.forbidden(res, 'Only the project owner can remove an admin');
      }
    }

    // Find and delete membership
    const member = await ProjectMember.findOneAndDelete({
      project_id: projectId,
      user_id: parseInt(userId)
    });

    if (!member) {
      return response.notFound(res, 'Member not found');
    }

    logger.info(`[ProjectMembers] Removed member ${userId} from project ${projectId}`);

    return response.success(res, { message: 'Member removed from project' });
  } catch (error) {
    logger.error('[ProjectMembers] removeMember error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Search users (for adding members)
 * GET /api/users/search?q=query
 */
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return response.badRequest(res, 'Search query must be at least 2 characters');
    }

    if (q.length > 100) {
      return response.badRequest(res, 'Search query too long');
    }

    // Escape regex special characters to prevent ReDoS
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Search by username or email
    const users = await User.find({
      $or: [
        { username: { $regex: escapedQuery, $options: 'i' } },
        { email: { $regex: escapedQuery, $options: 'i' } },
        { first_name: { $regex: escapedQuery, $options: 'i' } },
        { last_name: { $regex: escapedQuery, $options: 'i' } }
      ],
      is_active: true
    })
      .limit(10)
      .select('id username email first_name last_name')
      .lean();

    return response.successData(res, users);
  } catch (error) {
    logger.error('[ProjectMembers] searchUsers error:', error);
    return response.serverError(res, error.message);
  }
};

// Export the access check function for use in other controllers
exports.checkProjectAccess = checkProjectAccess;
