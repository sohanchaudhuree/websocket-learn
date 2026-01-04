/**
 * Message Controller
 * 
 * Handles message-related operations like fetching conversations,
 * sending messages, and marking messages as read.
 */

const Message = require('../models/Message');
const User = require('../models/User');

/**
 * Get conversation between current user and another user
 * 
 * @route   GET /api/messages/:userId
 * @access  Private
 */
const getConversation = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify the other user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Calculate skip for pagination
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Get messages using the static method
    const messages = await Message.getConversation(
      req.user._id,
      userId,
      parseInt(limit, 10),
      skip
    );

    // Get total count for pagination
    const total = await Message.countDocuments({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id },
      ],
    });

    // Reverse to get chronological order
    const sortedMessages = messages.reverse();

    res.status(200).json({
      success: true,
      data: {
        messages: sortedMessages,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message to another user (REST API alternative to WebSocket)
 * 
 * @route   POST /api/messages
 * @access  Private
 */
const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, content, messageType = 'text' } = req.body;

    // Validate required fields
    if (!receiverId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and content are required',
      });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found',
      });
    }

    // Prevent sending message to self
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to yourself',
      });
    }

    // Create message
    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      content,
      messageType,
    });

    // Populate sender and receiver details
    await message.populate([
      { path: 'sender', select: 'username avatar' },
      { path: 'receiver', select: 'username avatar' },
    ]);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark messages from a user as read
 * 
 * @route   PUT /api/messages/read/:userId
 * @access  Private
 */
const markMessagesAsRead = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Mark all messages from userId to current user as read
    const result = await Message.markAsRead(userId, req.user._id);

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread message count for current user
 * 
 * @route   GET /api/messages/unread/count
 * @access  Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Message.getUnreadCount(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        unreadCount: count,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of conversations (users with whom current user has chatted)
 * 
 * @route   GET /api/messages/conversations
 * @access  Private
 */
const getConversations = async (req, res, next) => {
  try {
    // Aggregate to get unique conversations with last message
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: req.user._id }, { receiver: req.user._id }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$receiver',
              '$sender',
            ],
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', req.user._id] },
                    { $eq: ['$isRead', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { 'lastMessage.createdAt': -1 },
      },
    ]);

    // Populate user details
    const populatedConversations = await User.populate(conversations, {
      path: '_id',
      select: 'username email avatar isOnline lastSeen',
    });

    // Format response
    const formattedConversations = populatedConversations.map((conv) => ({
      user: conv._id,
      lastMessage: {
        content: conv.lastMessage.content,
        createdAt: conv.lastMessage.createdAt,
        isFromMe: conv.lastMessage.sender.toString() === req.user._id.toString(),
      },
      unreadCount: conv.unreadCount,
    }));

    res.status(200).json({
      success: true,
      data: {
        conversations: formattedConversations,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversation,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
  getConversations,
};
