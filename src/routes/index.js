/**
 * Routes Index
 * 
 * Central export point for all route modules.
 */

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const messageRoutes = require('./messageRoutes');

module.exports = {
  authRoutes,
  userRoutes,
  messageRoutes,
};
