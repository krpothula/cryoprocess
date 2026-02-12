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

// Public routes (no authentication required)
// Register new user
// POST /api/auth/register
router.post('/register', asyncHandler(authController.register));

// Login
// POST /api/auth/login
router.post('/login', asyncHandler(authController.login));

// Protected routes (require authentication)
// Get current user
// GET /api/auth/me
router.get('/me', authMiddleware, asyncHandler(authController.getCurrentUser));

// Check password status (must change password?)
// GET /api/auth/password-status
router.get('/password-status', authMiddleware, asyncHandler(authController.getPasswordStatus));

// Change password
// POST /api/auth/change-password
router.post('/change-password', authMiddleware, asyncHandler(authController.changePassword));

// Update profile
// PUT /api/auth/profile
router.put('/profile', authMiddleware, asyncHandler(authController.updateProfile));

// Cluster SSH settings
// PUT /api/auth/cluster-settings
router.put('/cluster-settings', authMiddleware, asyncHandler(authController.updateClusterSettings));

// Test cluster SSH connection
// POST /api/auth/cluster-test
router.post('/cluster-test', authMiddleware, asyncHandler(authController.testClusterConnection));

// Refresh token
// POST /api/auth/refresh
router.post('/refresh', asyncHandler(authController.refreshToken));

// Logout (clear HttpOnly cookie)
// POST /api/auth/logout
router.post('/logout', authController.logout);

module.exports = router;
