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

// All routes require admin privileges
router.use(isAdmin);

// User management
router.get('/users', asyncHandler(adminController.listUsers));
router.post('/users', asyncHandler(adminController.createUser));
router.get('/users/:userId', asyncHandler(adminController.getUser));
router.patch('/users/:userId', asyncHandler(adminController.updateUser));
router.delete('/users/:userId', asyncHandler(adminController.deleteUser));
router.post('/users/:userId/reset-password', asyncHandler(adminController.resetPassword));

module.exports = router;
