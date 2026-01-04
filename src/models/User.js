/**
 * User Model
 * 
 * This model represents a user in the chat application.
 * It stores user credentials and profile information.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // Username - unique identifier for the user
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },

    // Email address - used for authentication
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },

    // Password - hashed before storage
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't include password in queries by default
    },

    // Online status - updated via WebSocket connection
    isOnline: {
      type: Boolean,
      default: false,
    },

    // Last seen timestamp - updated when user disconnects
    lastSeen: {
      type: Date,
      default: Date.now,
    },

    // Profile avatar URL (optional)
    avatar: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

/**
 * Pre-save middleware to hash password
 * Only hashes the password if it has been modified
 */
userSchema.pre('save', async function (next) {
  // Skip if password hasn't been modified
  if (!this.isModified('password')) {
    return next();
  }

  // Generate salt and hash password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Method to compare entered password with stored hash
 * 
 * @param {string} enteredPassword - Plain text password to compare
 * @returns {Promise<boolean>} True if passwords match
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Method to get public user data (excludes sensitive fields)
 * 
 * @returns {Object} Public user data
 */
userSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    username: this.username,
    email: this.email,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    avatar: this.avatar,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
