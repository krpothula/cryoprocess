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

/**
 * @swagger
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: List all projects for current user
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: include_archived
 *         schema: { type: string, enum: ['true','false'], default: 'false' }
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/Project' } }
 *                 count: { type: integer }
 */
router.get('/', asyncHandler(projectController.listProjects));

/**
 * @swagger
 * /projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [project_name]
 *             properties:
 *               project_name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201: { description: Project created }
 *       400: { description: Validation error }
 */
router.post('/', validate(createProjectSchema), asyncHandler(projectController.createProject));

/**
 * @swagger
 * /projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project by ID
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project details }
 *       404: { description: Project not found }
 */
router.get('/:projectId', asyncHandler(projectController.getProject));

/**
 * @swagger
 * /projects/{projectId}:
 *   put:
 *     tags: [Projects]
 *     summary: Update project (name, description, webhook URLs)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               project_name: { type: string }
 *               description: { type: string }
 *               webhook_urls:
 *                 type: array
 *                 items: { type: string }
 *                 maxItems: 5
 *     responses:
 *       200: { description: Project updated }
 *       403: { description: Not authorized }
 */
router.put('/:projectId', validate(updateProjectSchema), asyncHandler(projectController.updateProject));

/**
 * @swagger
 * /projects/{projectId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Delete project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirm: { type: boolean }
 *     responses:
 *       200: { description: Project deleted }
 */
router.delete('/:projectId', asyncHandler(projectController.deleteProject));

/**
 * @swagger
 * /projects/{projectId}/archive:
 *   put:
 *     tags: [Projects]
 *     summary: Archive a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Archive started }
 */
router.put('/:projectId/archive', asyncHandler(archiveController.archiveProject));

/**
 * @swagger
 * /projects/{projectId}/restore:
 *   put:
 *     tags: [Projects]
 *     summary: Restore an archived project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Restore started }
 */
router.put('/:projectId/restore', asyncHandler(archiveController.restoreProject));

/**
 * @swagger
 * /projects/{projectId}/relocate:
 *   put:
 *     tags: [Projects]
 *     summary: Relocate project directory (superuser only)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Relocated }
 */
router.put('/:projectId/relocate', asyncHandler(archiveController.relocateProject));

/**
 * @swagger
 * /projects/{projectId}/jobs:
 *   get:
 *     tags: [Projects]
 *     summary: Get all jobs for a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/Job' } }
 */
router.get('/:projectId/jobs', asyncHandler(projectController.getProjectJobs));

/**
 * @swagger
 * /projects/{projectId}/members:
 *   get:
 *     tags: [Project Members]
 *     summary: List project members
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Members list }
 */
router.get('/:projectId/members', asyncHandler(projectMemberController.listMembers));

/**
 * @swagger
 * /projects/{projectId}/members:
 *   post:
 *     tags: [Project Members]
 *     summary: Add member to project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id: { type: integer }
 *               role: { type: string, enum: [viewer, editor, admin] }
 *     responses:
 *       201: { description: Member added }
 */
router.post('/:projectId/members', asyncHandler(projectMemberController.addMember));

/**
 * @swagger
 * /projects/{projectId}/members/{userId}:
 *   put:
 *     tags: [Project Members]
 *     summary: Update member role
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [viewer, editor, admin] }
 *     responses:
 *       200: { description: Role updated }
 */
router.put('/:projectId/members/:userId', asyncHandler(projectMemberController.updateMember));

/**
 * @swagger
 * /projects/{projectId}/members/{userId}:
 *   delete:
 *     tags: [Project Members]
 *     summary: Remove member from project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Member removed }
 */
router.delete('/:projectId/members/:userId', asyncHandler(projectMemberController.removeMember));

module.exports = router;
