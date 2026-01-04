/**
 * User Routes
 * 
 * Routes for user-related operations.
 * All routes are protected (require authentication).
 */

const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getOnlineUsers,
  getUserById,
  searchUsers,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// User routes
router.get('/', getAllUsers);
router.get('/online', getOnlineUsers);
router.get('/search', searchUsers);
router.get('/:id', getUserById);

module.exports = router;
