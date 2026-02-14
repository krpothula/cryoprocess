/**
 * Authentication Routes
 *
 * API endpoints for user authentication.
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { loginSchema, registerSchema, changePasswordSchema, updateProfileSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validations/authSchemas');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
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
 *     responses:
 *       201: { description: User created }
 *       400: { description: Validation error }
 */
router.post('/register', validate(registerSchema), asyncHandler(authController.register));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive JWT cookie
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful, sets HttpOnly cookie }
 *       401: { description: Invalid credentials }
 */
router.post('/login', validate(loginSchema), asyncHandler(authController.login));

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 *     responses:
 *       200:
 *         description: Current user info
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 */
router.get('/me', authMiddleware, asyncHandler(authController.getCurrentUser));

/**
 * @swagger
 * /auth/password-status:
 *   get:
 *     tags: [Auth]
 *     summary: Check if user must change password
 *     responses:
 *       200: { description: Password status }
 */
router.get('/password-status', authMiddleware, asyncHandler(authController.getPasswordStatus));

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password: { type: string }
 *               new_password: { type: string }
 *     responses:
 *       200: { description: Password changed }
 *       400: { description: Validation error }
 */
router.post('/change-password', authMiddleware, validate(changePasswordSchema), asyncHandler(authController.changePassword));

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update user profile
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name: { type: string }
 *               last_name: { type: string }
 *               email: { type: string }
 *     responses:
 *       200: { description: Profile updated }
 */
router.put('/profile', authMiddleware, validate(updateProfileSchema), asyncHandler(authController.updateProfile));

/**
 * @swagger
 * /auth/cluster-settings:
 *   put:
 *     tags: [Auth]
 *     summary: Update cluster SSH settings
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ssh_host: { type: string }
 *               ssh_username: { type: string }
 *               ssh_key_path: { type: string }
 *     responses:
 *       200: { description: Settings updated }
 */
router.put('/cluster-settings', authMiddleware, asyncHandler(authController.updateClusterSettings));

/**
 * @swagger
 * /auth/cluster-test:
 *   post:
 *     tags: [Auth]
 *     summary: Test cluster SSH connection
 *     responses:
 *       200: { description: Connection successful }
 *       500: { description: Connection failed }
 */
router.post('/cluster-test', authMiddleware, asyncHandler(authController.testClusterConnection));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh JWT token
 *     security: []
 *     responses:
 *       200: { description: New token issued }
 *       401: { description: Invalid refresh token }
 */
router.post('/refresh', asyncHandler(authController.refreshToken));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and clear cookie
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: Reset email sent (always returns success) }
 */
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, new_password, confirm_password]
 *             properties:
 *               token: { type: string }
 *               new_password: { type: string }
 *               confirm_password: { type: string }
 *     responses:
 *       200: { description: Password reset successful }
 *       400: { description: Invalid or expired token }
 */
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(authController.resetPassword));

module.exports = router;
