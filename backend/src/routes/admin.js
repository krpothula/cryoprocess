/**
 * Admin Routes
 *
 * User management and admin-only operations.
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { createUserSchema, updateUserSchema } = require('../validations/adminSchemas');

// All routes require admin privileges
router.use(isAdmin);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (admin only)
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/User' } }
 */
router.get('/users', asyncHandler(adminController.listUsers));

/**
 * @swagger
 * /admin/users:
 *   post:
 *     tags: [Admin]
 *     summary: Create a new user (admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               first_name: { type: string }
 *               last_name: { type: string }
 *               is_staff: { type: boolean }
 *     responses:
 *       201: { description: User created }
 */
router.post('/users', validate(createUserSchema), asyncHandler(adminController.createUser));

/**
 * @swagger
 * /admin/users/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user by ID (admin only)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: User details }
 */
router.get('/users/:userId', asyncHandler(adminController.getUser));

/**
 * @swagger
 * /admin/users/{userId}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update user (admin only)
 *     parameters:
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
 *               first_name: { type: string }
 *               last_name: { type: string }
 *               email: { type: string }
 *               is_staff: { type: boolean }
 *               is_active: { type: boolean }
 *     responses:
 *       200: { description: User updated }
 */
router.patch('/users/:userId', validate(updateUserSchema), asyncHandler(adminController.updateUser));

/**
 * @swagger
 * /admin/users/{userId}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete user (admin only)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: User deleted }
 */
router.delete('/users/:userId', asyncHandler(adminController.deleteUser));

/**
 * @swagger
 * /admin/users/{userId}/reset-password:
 *   post:
 *     tags: [Admin]
 *     summary: Reset user password (admin only)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Password reset, temporary password returned }
 */
router.post('/users/:userId/reset-password', asyncHandler(adminController.resetPassword));

/**
 * @swagger
 * /admin/users/{userId}/generate-api-key:
 *   post:
 *     tags: [Admin]
 *     summary: Generate API key for user (admin only)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: API key generated }
 */
router.post('/users/:userId/generate-api-key', asyncHandler(adminController.generateApiKey));

/**
 * @swagger
 * /admin/users/{userId}/api-key:
 *   delete:
 *     tags: [Admin]
 *     summary: Revoke API key for user (admin only)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: API key revoked }
 */
router.delete('/users/:userId/api-key', asyncHandler(adminController.revokeApiKey));

module.exports = router;
