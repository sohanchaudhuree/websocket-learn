/**
 * Message Routes
 * 
 * Routes for message-related operations.
 * All routes are protected (require authentication).
 */

const express = require('express');
const router = express.Router();

const {
  getConversation,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
  getConversations,
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Message routes
router.get('/conversations', getConversations);
router.get('/unread/count', getUnreadCount);
router.get('/:userId', getConversation);
router.post('/', sendMessage);
router.put('/read/:userId', markMessagesAsRead);

module.exports = router;
