/**
 * ============================================================================
 * Express.js WebSocket Chat Server
 * ============================================================================
 * 
 * Main entry point for the application.
 * 
 * This server provides:
 * - REST API for user authentication and data management
 * - WebSocket server for real-time chat functionality
 * - MongoDB integration for data persistence
 * 
 * ============================================================================
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');

// Import configuration
const { connectDatabase } = require('./config/database');

// Import routes
const { authRoutes, userRoutes, messageRoutes } = require('./routes');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import WebSocket
const { initializeWebSocket } = require('./websocket');

// ============================================================================
// CREATE EXPRESS APP AND HTTP SERVER
// ============================================================================

const app = express();

// Create HTTP server (needed for WebSocket)
const server = http.createServer(app);

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Enable CORS for cross-origin requests
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// API ROUTES
// ============================================================================

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// API documentation endpoint
app.get('/api', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'WebSocket Chat API',
    version: '1.0.0',
    documentation: {
      auth: '/api/auth - Authentication endpoints',
      users: '/api/users - User management endpoints',
      messages: '/api/messages - Message endpoints',
      websocket: 'ws://localhost:PORT/ws - WebSocket endpoint',
    },
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register a new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/me': 'Get current user (requires auth)',
        'PUT /api/auth/profile': 'Update profile (requires auth)',
        'PUT /api/auth/password': 'Change password (requires auth)',
      },
      users: {
        'GET /api/users': 'Get all users (requires auth)',
        'GET /api/users/online': 'Get online users (requires auth)',
        'GET /api/users/search?query=': 'Search users (requires auth)',
        'GET /api/users/:id': 'Get user by ID (requires auth)',
      },
      messages: {
        'GET /api/messages/conversations': 'Get conversations (requires auth)',
        'GET /api/messages/unread/count': 'Get unread count (requires auth)',
        'GET /api/messages/:userId': 'Get conversation with user (requires auth)',
        'POST /api/messages': 'Send message (requires auth)',
        'PUT /api/messages/read/:userId': 'Mark as read (requires auth)',
      },
    },
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Handle 404 errors
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3000;

/**
 * Start the server
 * 
 * This function:
 * 1. Connects to MongoDB
 * 2. Initializes WebSocket server
 * 3. Starts HTTP server
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Initialize WebSocket server
    initializeWebSocket(server);

    // Start HTTP server
    server.listen(PORT, () => {
      console.log('============================================');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 REST API: http://localhost:${PORT}/api`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
      console.log('============================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error.message);
  process.exit(1);
});

// Start the server
startServer();

module.exports = { app, server };
