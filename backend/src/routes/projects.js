/**
 * Projects Routes
 *
 * API endpoints for project management.
 */

const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const projectMemberController = require('../controllers/projectMemberController');
const asyncHandler = require('../utils/asyncHandler');

// List all projects
// GET /api/projects
router.get('/', asyncHandler(projectController.listProjects));

// Create a new project
// POST /api/projects
router.post('/', asyncHandler(projectController.createProject));

// Get project by ID
// GET /api/projects/:projectId
router.get('/:projectId', asyncHandler(projectController.getProject));

// Update project
// PUT /api/projects/:projectId
router.put('/:projectId', asyncHandler(projectController.updateProject));

// Delete project
// DELETE /api/projects/:projectId
router.delete('/:projectId', asyncHandler(projectController.deleteProject));

// Get all jobs for a project
// GET /api/projects/:projectId/jobs
router.get('/:projectId/jobs', asyncHandler(projectController.getProjectJobs));

// Project member routes
// List project members
// GET /api/projects/:projectId/members
router.get('/:projectId/members', asyncHandler(projectMemberController.listMembers));

// Add member to project
// POST /api/projects/:projectId/members
router.post('/:projectId/members', asyncHandler(projectMemberController.addMember));

// Update member role
// PUT /api/projects/:projectId/members/:userId
router.put('/:projectId/members/:userId', asyncHandler(projectMemberController.updateMember));

// Remove member from project
// DELETE /api/projects/:projectId/members/:userId
router.delete('/:projectId/members/:userId', asyncHandler(projectMemberController.removeMember));

module.exports = router;
