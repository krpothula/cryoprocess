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

router.post('/register', validate(registerSchema), asyncHandler(authController.register));
router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.get('/me', authMiddleware, asyncHandler(authController.getCurrentUser));
router.get('/password-status', authMiddleware, asyncHandler(authController.getPasswordStatus));
router.post('/change-password', authMiddleware, validate(changePasswordSchema), asyncHandler(authController.changePassword));
router.put('/profile', authMiddleware, validate(updateProfileSchema), asyncHandler(authController.updateProfile));
router.put('/cluster-settings', authMiddleware, asyncHandler(authController.updateClusterSettings));
router.post('/cluster-test', authMiddleware, asyncHandler(authController.testClusterConnection));
router.post('/refresh', asyncHandler(authController.refreshToken));
router.post('/logout', authController.logout);
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(authController.resetPassword));

module.exports = router;
