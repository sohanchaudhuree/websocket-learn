/**
 * Message Model
 * 
 * This model represents a chat message between two users.
 * It stores message content, sender, receiver, and metadata.
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    // Sender of the message (references User model)
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
    },

    // Receiver of the message (references User model)
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver is required'],
    },

    // Message content
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },

    // Message type (text, image, file, etc.)
    messageType: {
      type: String,
      enum: ['text', 'image', 'file'],
      default: 'text',
    },

    // Read status - tracks if receiver has read the message
    isRead: {
      type: Boolean,
      default: false,
    },

    // Timestamp when message was read
    readAt: {
      type: Date,
      default: null,
    },

    // Delivery status
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

/**
 * Index for efficient querying of conversations between two users
 * Also helps with sorting messages by timestamp
 */
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });

/**
 * Static method to get conversation between two users
 * 
 * @param {string} userId1 - First user's ID
 * @param {string} userId2 - Second user's ID
 * @param {number} limit - Number of messages to fetch (default: 50)
 * @param {number} skip - Number of messages to skip (for pagination)
 * @returns {Promise<Array>} Array of messages
 */
messageSchema.statics.getConversation = async function (
  userId1,
  userId2,
  limit = 50,
  skip = 0
) {
  return await this.find({
    $or: [
      { sender: userId1, receiver: userId2 },
      { sender: userId2, receiver: userId1 },
    ],
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'username avatar')
    .populate('receiver', 'username avatar');
};

/**
 * Static method to mark messages as read
 * 
 * @param {string} senderId - Sender's ID
 * @param {string} receiverId - Receiver's ID (current user)
 * @returns {Promise<Object>} Update result
 */
messageSchema.statics.markAsRead = async function (senderId, receiverId) {
  return await this.updateMany(
    {
      sender: senderId,
      receiver: receiverId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
        status: 'read',
      },
    }
  );
};

/**
 * Static method to get unread message count for a user
 * 
 * @param {string} userId - User's ID
 * @returns {Promise<number>} Count of unread messages
 */
messageSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({
    receiver: userId,
    isRead: false,
  });
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
