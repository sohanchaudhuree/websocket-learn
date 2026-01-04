/**
 * Models Index
 * 
 * Central export point for all database models.
 * Import models from this file for consistency.
 */

const User = require('./User');
const Message = require('./Message');

module.exports = {
  User,
  Message,
};
