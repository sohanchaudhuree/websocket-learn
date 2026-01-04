/**
 * ============================================================================
 * WebSocket Server Implementation
 * ============================================================================
 * 
 * This module provides real-time bidirectional communication for the chat
 * application. It is designed to be:
 * 
 * - ISOLATED: All WebSocket logic is contained in this directory
 * - WELL-COMMENTED: Every function and important line is documented
 * - EASY TO UNDERSTAND: Clear naming conventions and flow
 * 
 * MESSAGE FLOW OVERVIEW:
 * ======================
 * 
 * 1. Client connects with JWT token for authentication
 * 2. Server validates token and registers user as online
 * 3. Server broadcasts online users list to all connected clients
 * 4. Clients can send messages to specific users
 * 5. Server delivers messages instantly to recipient if online
 * 6. Messages are persisted to MongoDB for history
 * 
 * SUPPORTED MESSAGE TYPES:
 * ========================
 * 
 * Client → Server:
 * - chat_message: Send a message to another user
 * - typing_start: Notify that user started typing
 * - typing_stop: Notify that user stopped typing
 * - mark_read: Mark messages from a user as read
 * 
 * Server → Client:
 * - new_message: Receive a new message
 * - message_sent: Confirmation of sent message
 * - typing_indicator: Someone is typing to you
 * - online_users: Updated list of online users
 * - user_online: A user came online
 * - user_offline: A user went offline
 * - error: Error message
 * 
 * ============================================================================
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/Message');

// ============================================================================
// CONNECTED CLIENTS STORAGE
// ============================================================================

/**
 * Map to store connected WebSocket clients
 * Key: User ID (string)
 * Value: WebSocket connection object with additional metadata
 * 
 * This allows us to:
 * - Quickly find a user's connection by their ID
 * - Send messages to specific users
 * - Track who is currently online
 */
const connectedClients = new Map();

// ============================================================================
// WEBSOCKET SERVER INITIALIZATION
// ============================================================================

/**
 * Initialize WebSocket server and attach to HTTP server
 * 
 * @param {http.Server} server - HTTP server instance to attach WebSocket to
 * @returns {WebSocket.Server} The WebSocket server instance
 */
const initializeWebSocket = (server) => {
  // Create WebSocket server attached to HTTP server
  // Using a separate path '/ws' for WebSocket connections
  const wss = new WebSocket.Server({
    server,
    path: '/ws', // WebSocket endpoint: ws://localhost:3000/ws
  });

  console.log('🔌 WebSocket server initialized at path: /ws');

  // ========================================================================
  // CONNECTION HANDLER
  // ========================================================================

  /**
   * Handle new WebSocket connections
   * Each connection goes through:
   * 1. Authentication validation
   * 2. User registration
   * 3. Online status broadcast
   */
  wss.on('connection', async (ws, req) => {
    console.log('📡 New WebSocket connection attempt...');

    // --------------------------------------------------------------------
    // STEP 1: Extract and validate authentication token
    // --------------------------------------------------------------------
    
    // Token can be passed via:
    // Option 1: Query parameter - ws://localhost:3000/ws?token=YOUR_JWT_TOKEN
    // Option 2: Protocol header (for clients that support it)
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    // Validate token presence
    if (!token) {
      console.log('❌ Connection rejected: No token provided');
      sendError(ws, 'Authentication required. Please provide a valid token.');
      ws.close(4001, 'Authentication required');
      return;
    }

    // Verify JWT token
    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('❌ Connection rejected: Invalid token');
      sendError(ws, 'Invalid or expired token. Please login again.');
      ws.close(4002, 'Invalid token');
      return;
    }

    // --------------------------------------------------------------------
    // STEP 2: Fetch user from database and validate
    // --------------------------------------------------------------------
    
    let user;
    try {
      user = await User.findById(decoded.id);
      if (!user) {
        console.log('❌ Connection rejected: User not found');
        sendError(ws, 'User not found.');
        ws.close(4003, 'User not found');
        return;
      }
    } catch (error) {
      console.error('❌ Database error during authentication:', error.message);
      sendError(ws, 'Server error during authentication.');
      ws.close(4004, 'Server error');
      return;
    }

    // --------------------------------------------------------------------
    // STEP 3: Register user connection
    // --------------------------------------------------------------------
    
    // Store user info on the WebSocket connection
    ws.userId = user._id.toString();
    ws.username = user.username;
    ws.isAlive = true; // For heartbeat/ping-pong mechanism

    // Check if user already has an existing connection
    // If so, close the old connection (one connection per user)
    if (connectedClients.has(ws.userId)) {
      const oldConnection = connectedClients.get(ws.userId);
      console.log(`🔄 Closing old connection for user: ${ws.username}`);
      oldConnection.close(4005, 'New connection established');
    }

    // Store the new connection
    connectedClients.set(ws.userId, ws);

    console.log(`✅ User connected: ${ws.username} (${ws.userId})`);
    console.log(`📊 Total connected users: ${connectedClients.size}`);

    // --------------------------------------------------------------------
    // STEP 4: Update user online status in database
    // --------------------------------------------------------------------
    
    await User.findByIdAndUpdate(ws.userId, { isOnline: true });

    // --------------------------------------------------------------------
    // STEP 5: Send welcome message and broadcast online status
    // --------------------------------------------------------------------
    
    // Send welcome message to the newly connected user
    sendToClient(ws, {
      type: 'connection_established',
      data: {
        message: 'Connected to chat server',
        userId: ws.userId,
        username: ws.username,
      },
    });

    // Broadcast to all clients that this user came online
    broadcastUserStatus(ws.userId, ws.username, true, wss);

    // Send updated online users list to all clients
    await broadcastOnlineUsers(wss);

    // ========================================================================
    // MESSAGE HANDLER
    // ========================================================================

    /**
     * Handle incoming messages from this client
     */
    ws.on('message', async (data) => {
      try {
        // Parse the incoming message (expecting JSON)
        const message = JSON.parse(data.toString());
        
        // Route message to appropriate handler based on type
        await handleMessage(ws, message, wss);
      } catch (error) {
        console.error(`❌ Error processing message from ${ws.username}:`, error.message);
        sendError(ws, 'Invalid message format. Please send valid JSON.');
      }
    });

    // ========================================================================
    // DISCONNECT HANDLER
    // ========================================================================

    /**
     * Handle client disconnection
     */
    ws.on('close', async (code, reason) => {
      console.log(`👋 User disconnected: ${ws.username} (Code: ${code})`);

      // Remove from connected clients
      connectedClients.delete(ws.userId);

      // Update user status in database
      await User.findByIdAndUpdate(ws.userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      // Broadcast to all clients that this user went offline
      broadcastUserStatus(ws.userId, ws.username, false, wss);

      // Send updated online users list to all clients
      await broadcastOnlineUsers(wss);

      console.log(`📊 Total connected users: ${connectedClients.size}`);
    });

    // ========================================================================
    // ERROR HANDLER
    // ========================================================================

    /**
     * Handle WebSocket errors
     */
    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for ${ws.username}:`, error.message);
    });

    // ========================================================================
    // PING-PONG FOR CONNECTION HEALTH
    // ========================================================================

    /**
     * Respond to ping from client (heartbeat mechanism)
     */
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });

  // ==========================================================================
  // HEARTBEAT MECHANISM
  // ==========================================================================

  /**
   * Periodically check if connections are still alive
   * This helps detect and clean up dead connections
   */
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      // If client didn't respond to last ping, terminate connection
      if (ws.isAlive === false) {
        console.log(`💔 Terminating dead connection: ${ws.username}`);
        return ws.terminate();
      }

      // Mark as not alive and send ping
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // Check every 30 seconds

  // Clean up heartbeat interval when server closes
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
};

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

/**
 * Route incoming messages to appropriate handlers
 * 
 * @param {WebSocket} ws - WebSocket connection of sender
 * @param {Object} message - Parsed message object
 * @param {WebSocket.Server} wss - WebSocket server instance
 */
const handleMessage = async (ws, message, wss) => {
  const { type, data } = message;

  console.log(`📨 Message from ${ws.username}: ${type}`);

  switch (type) {
    // --------------------------------------------------------------------------
    // CHAT MESSAGE - Send a message to another user
    // --------------------------------------------------------------------------
    case 'chat_message':
      await handleChatMessage(ws, data, wss);
      break;

    // --------------------------------------------------------------------------
    // TYPING INDICATORS - Show when user is typing
    // --------------------------------------------------------------------------
    case 'typing_start':
      handleTypingIndicator(ws, data, true);
      break;

    case 'typing_stop':
      handleTypingIndicator(ws, data, false);
      break;

    // --------------------------------------------------------------------------
    // MARK AS READ - Mark messages from a user as read
    // --------------------------------------------------------------------------
    case 'mark_read':
      await handleMarkRead(ws, data);
      break;

    // --------------------------------------------------------------------------
    // GET ONLINE USERS - Request current online users list
    // --------------------------------------------------------------------------
    case 'get_online_users':
      await sendOnlineUsersToClient(ws);
      break;

    // --------------------------------------------------------------------------
    // UNKNOWN MESSAGE TYPE
    // --------------------------------------------------------------------------
    default:
      sendError(ws, `Unknown message type: ${type}`);
  }
};

/**
 * Handle sending a chat message
 * 
 * Expected data format:
 * {
 *   receiverId: "user_id_string",
 *   content: "Message text",
 *   messageType: "text" (optional, defaults to "text")
 * }
 * 
 * @param {WebSocket} ws - Sender's WebSocket connection
 * @param {Object} data - Message data
 * @param {WebSocket.Server} _wss - WebSocket server instance (unused)
 */
const handleChatMessage = async (ws, data, _wss) => {
  const { receiverId, content, messageType = 'text' } = data;

  // Validate required fields
  if (!receiverId || !content) {
    sendError(ws, 'Missing required fields: receiverId and content');
    return;
  }

  // Prevent sending message to self
  if (receiverId === ws.userId) {
    sendError(ws, 'Cannot send message to yourself');
    return;
  }

  try {
    // ------------------------------------------------------------------
    // STEP 1: Save message to database
    // ------------------------------------------------------------------
    
    const newMessage = await Message.create({
      sender: ws.userId,
      receiver: receiverId,
      content,
      messageType,
      status: 'sent',
    });

    // Populate sender and receiver info
    await newMessage.populate([
      { path: 'sender', select: 'username avatar' },
      { path: 'receiver', select: 'username avatar' },
    ]);

    // ------------------------------------------------------------------
    // STEP 2: Send confirmation to sender
    // ------------------------------------------------------------------
    
    sendToClient(ws, {
      type: 'message_sent',
      data: {
        messageId: newMessage._id,
        receiverId,
        content,
        createdAt: newMessage.createdAt,
        status: 'sent',
      },
    });

    // ------------------------------------------------------------------
    // STEP 3: Deliver message to receiver if online
    // ------------------------------------------------------------------
    
    const receiverConnection = connectedClients.get(receiverId);
    
    if (receiverConnection && receiverConnection.readyState === WebSocket.OPEN) {
      // Receiver is online - deliver instantly
      sendToClient(receiverConnection, {
        type: 'new_message',
        data: {
          messageId: newMessage._id,
          senderId: ws.userId,
          senderUsername: ws.username,
          content,
          messageType,
          createdAt: newMessage.createdAt,
        },
      });

      // Update message status to delivered
      await Message.findByIdAndUpdate(newMessage._id, { status: 'delivered' });

      // Notify sender that message was delivered
      sendToClient(ws, {
        type: 'message_delivered',
        data: {
          messageId: newMessage._id,
          deliveredAt: new Date(),
        },
      });

      console.log(`✉️ Message delivered: ${ws.username} → ${receiverConnection.username}`);
    } else {
      // Receiver is offline - message will be delivered when they connect
      console.log(`📭 Message saved (receiver offline): ${ws.username} → ${receiverId}`);
    }
  } catch (error) {
    console.error('❌ Error saving message:', error.message);
    sendError(ws, 'Failed to send message. Please try again.');
  }
};

/**
 * Handle typing indicator
 * 
 * Expected data format:
 * {
 *   receiverId: "user_id_string"
 * }
 * 
 * @param {WebSocket} ws - Sender's WebSocket connection
 * @param {Object} data - Data containing receiverId
 * @param {boolean} isTyping - Whether user started or stopped typing
 */
const handleTypingIndicator = (ws, data, isTyping) => {
  const { receiverId } = data;

  if (!receiverId) {
    sendError(ws, 'Missing required field: receiverId');
    return;
  }

  // Find receiver's connection
  const receiverConnection = connectedClients.get(receiverId);

  // Only send if receiver is online
  if (receiverConnection && receiverConnection.readyState === WebSocket.OPEN) {
    sendToClient(receiverConnection, {
      type: 'typing_indicator',
      data: {
        userId: ws.userId,
        username: ws.username,
        isTyping,
      },
    });
  }
};

/**
 * Handle marking messages as read
 * 
 * Expected data format:
 * {
 *   senderId: "user_id_string"
 * }
 * 
 * @param {WebSocket} ws - Current user's WebSocket connection
 * @param {Object} data - Data containing senderId
 */
const handleMarkRead = async (ws, data) => {
  const { senderId } = data;

  if (!senderId) {
    sendError(ws, 'Missing required field: senderId');
    return;
  }

  try {
    // Mark all messages from sender to current user as read
    const result = await Message.markAsRead(senderId, ws.userId);

    // Notify the sender that their messages have been read
    const senderConnection = connectedClients.get(senderId);
    if (senderConnection && senderConnection.readyState === WebSocket.OPEN) {
      sendToClient(senderConnection, {
        type: 'messages_read',
        data: {
          readBy: ws.userId,
          readByUsername: ws.username,
          readAt: new Date(),
        },
      });
    }

    // Confirm to current user
    sendToClient(ws, {
      type: 'mark_read_success',
      data: {
        senderId,
        markedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error('❌ Error marking messages as read:', error.message);
    sendError(ws, 'Failed to mark messages as read.');
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Send a message to a specific client
 * 
 * @param {WebSocket} ws - Target WebSocket connection
 * @param {Object} message - Message object to send
 */
const sendToClient = (ws, message) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
};

/**
 * Send an error message to a client
 * 
 * @param {WebSocket} ws - Target WebSocket connection
 * @param {string} errorMessage - Error message text
 */
const sendError = (ws, errorMessage) => {
  sendToClient(ws, {
    type: 'error',
    data: {
      message: errorMessage,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Broadcast user online/offline status to all connected clients
 * 
 * @param {string} userId - User's ID
 * @param {string} username - User's username
 * @param {boolean} isOnline - Whether user is online
 * @param {WebSocket.Server} wss - WebSocket server instance
 */
const broadcastUserStatus = (userId, username, isOnline, wss) => {
  const message = {
    type: isOnline ? 'user_online' : 'user_offline',
    data: {
      userId,
      username,
      timestamp: new Date().toISOString(),
    },
  };

  // Broadcast to all connected clients except the user themselves
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.userId !== userId) {
      client.send(JSON.stringify(message));
    }
  });
};

/**
 * Broadcast updated online users list to all connected clients
 * 
 * @param {WebSocket.Server} wss - WebSocket server instance
 */
const broadcastOnlineUsers = async (wss) => {
  // Get all online users from database
  const onlineUsers = await User.find({ isOnline: true }).select(
    '_id username avatar'
  );

  const message = {
    type: 'online_users',
    data: {
      users: onlineUsers,
      totalOnline: onlineUsers.length,
      timestamp: new Date().toISOString(),
    },
  };

  // Broadcast to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

/**
 * Send online users list to a specific client
 * 
 * @param {WebSocket} ws - Target WebSocket connection
 */
const sendOnlineUsersToClient = async (ws) => {
  const onlineUsers = await User.find({ isOnline: true }).select(
    '_id username avatar'
  );

  sendToClient(ws, {
    type: 'online_users',
    data: {
      users: onlineUsers,
      totalOnline: onlineUsers.length,
      timestamp: new Date().toISOString(),
    },
  });
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  initializeWebSocket,
  connectedClients,
  sendToClient,
};
