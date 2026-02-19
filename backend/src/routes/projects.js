/**
 * Projects Routes
 *
 * API endpoints for project management.
 */

const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const projectMemberController = require('../controllers/projectMemberController');
const archiveController = require('../controllers/archiveController');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { createProjectSchema, updateProjectSchema } = require('../validations/projectSchemas');

router.get('/', asyncHandler(projectController.listProjects));
router.post('/', validate(createProjectSchema), asyncHandler(projectController.createProject));
router.get('/:projectId', asyncHandler(projectController.getProject));
router.put('/:projectId', validate(updateProjectSchema), asyncHandler(projectController.updateProject));
router.delete('/:projectId', asyncHandler(projectController.deleteProject));
router.put('/:projectId/archive', asyncHandler(archiveController.archiveProject));
router.put('/:projectId/restore', asyncHandler(archiveController.restoreProject));
router.put('/:projectId/relocate', asyncHandler(archiveController.relocateProject));
router.get('/:projectId/jobs', asyncHandler(projectController.getProjectJobs));
router.get('/:projectId/members', asyncHandler(projectMemberController.listMembers));
router.post('/:projectId/members', asyncHandler(projectMemberController.addMember));
router.put('/:projectId/members/:userId', asyncHandler(projectMemberController.updateMember));
router.delete('/:projectId/members/:userId', asyncHandler(projectMemberController.removeMember));

module.exports = router;
