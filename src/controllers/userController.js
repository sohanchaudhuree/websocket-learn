/**
 * User Controller
 * 
 * Handles user-related operations like fetching users list,
 * getting user profiles, and searching users.
 */

const User = require('../models/User');

/**
 * Get all users (excluding current user)
 * 
 * @route   GET /api/users
 * @access  Private
 */
const getAllUsers = async (req, res, next) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Fetch users excluding current user
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('username email avatar isOnline lastSeen')
      .skip(skip)
      .limit(limit)
      .sort({ isOnline: -1, username: 1 }); // Online users first, then alphabetically

    // Get total count for pagination
    const total = await User.countDocuments({ _id: { $ne: req.user._id } });

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get online users only
 * 
 * @route   GET /api/users/online
 * @access  Private
 */
const getOnlineUsers = async (req, res, next) => {
  try {
    // Fetch only online users (excluding current user)
    const users = await User.find({
      _id: { $ne: req.user._id },
      isOnline: true,
    }).select('username email avatar isOnline');

    // Get total count of all online users (including current user)
    const totalOnline = await User.countDocuments({ isOnline: true });

    res.status(200).json({
      success: true,
      data: {
        users,
        totalOnline,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 * 
 * @route   GET /api/users/:id
 * @access  Private
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      'username email avatar isOnline lastSeen createdAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search users by username or email
 * 
 * @route   GET /api/users/search
 * @access  Private
 */
const searchUsers = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    // Search users by username or email (case-insensitive)
    // Use regex with proper escaping to prevent injection
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { username: { $regex: escapedQuery, $options: 'i' } },
        { email: { $regex: escapedQuery, $options: 'i' } },
      ],
    })
      .select('username email avatar isOnline lastSeen')
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        users,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getOnlineUsers,
  getUserById,
  searchUsers,
};
