# WebSocket Architecture and Message Flow

This document explains the WebSocket architecture and message flow for the real-time chat application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Connection Flow](#connection-flow)
3. [Message Types](#message-types)
4. [Message Flow Diagrams](#message-flow-diagrams)
5. [Error Handling](#error-handling)
6. [Connection Management](#connection-management)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
│                   (React, Flutter, Mobile Apps)                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ WebSocket Connection
                              │ ws://server:3000/ws?token=JWT_TOKEN
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                        Express.js Server                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   HTTP Server (Port 3000)                │   │
│  │  ┌─────────────────────┐  ┌───────────────────────────┐│   │
│  │  │    REST API         │  │    WebSocket Server       ││   │
│  │  │  /api/auth          │  │      /ws                  ││   │
│  │  │  /api/users         │  │                           ││   │
│  │  │  /api/messages      │  │  ┌─────────────────────┐ ││   │
│  │  │                     │  │  │ Connected Clients   │ ││   │
│  │  │                     │  │  │ Map<UserId, Socket> │ ││   │
│  │  └─────────────────────┘  │  └─────────────────────┘ ││   │
│  │                           └───────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      MongoDB        │
                    │  ┌───────────────┐  │
                    │  │    Users      │  │
                    │  │   Messages    │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
```

### Key Components

| Component | Description |
|-----------|-------------|
| **HTTP Server** | Express.js server handling REST API requests |
| **WebSocket Server** | ws library server for real-time communication |
| **Connected Clients Map** | In-memory storage mapping user IDs to their WebSocket connections |
| **MongoDB** | Persistent storage for users and messages |

---

## Connection Flow

### Initial Connection Sequence

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │                    │ Database │
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                               │                               │
     │  1. Connect with JWT Token    │                               │
     │  ws://server/ws?token=xxx     │                               │
     │ ─────────────────────────────>│                               │
     │                               │                               │
     │                               │  2. Verify JWT Token          │
     │                               │                               │
     │                               │  3. Fetch User                │
     │                               │ ─────────────────────────────>│
     │                               │                               │
     │                               │  4. User Data                 │
     │                               │ <─────────────────────────────│
     │                               │                               │
     │                               │  5. Update isOnline = true    │
     │                               │ ─────────────────────────────>│
     │                               │                               │
     │  6. connection_established    │                               │
     │ <─────────────────────────────│                               │
     │                               │                               │
     │  7. online_users list         │                               │
     │ <─────────────────────────────│                               │
     │                               │                               │
     │                               │  8. Broadcast user_online     │
     │                               │     to other clients          │
     │                               │                               │
```

### Connection Validation Steps

1. **Token Extraction**: Token is extracted from query parameter
2. **JWT Verification**: Token is verified using the secret key
3. **User Lookup**: User is fetched from database
4. **Duplicate Check**: If user already connected, close old connection
5. **Registration**: Store connection in `connectedClients` Map
6. **Status Update**: Update user's `isOnline` status in database
7. **Notification**: Broadcast user's online status to all clients

---

## Message Types

### Client → Server Messages

| Type | Description | Required Data |
|------|-------------|---------------|
| `chat_message` | Send a message to another user | `receiverId`, `content`, `messageType?` |
| `typing_start` | Notify recipient that you started typing | `receiverId` |
| `typing_stop` | Notify recipient that you stopped typing | `receiverId` |
| `mark_read` | Mark messages from a user as read | `senderId` |
| `get_online_users` | Request current online users list | - |

### Server → Client Messages

| Type | Description | Data Included |
|------|-------------|---------------|
| `connection_established` | Confirmation of successful connection | `userId`, `username` |
| `new_message` | Received a new message | `messageId`, `senderId`, `senderUsername`, `content`, `messageType`, `createdAt` |
| `message_sent` | Confirmation of sent message | `messageId`, `receiverId`, `content`, `createdAt`, `status` |
| `message_delivered` | Message was delivered to recipient | `messageId`, `deliveredAt` |
| `messages_read` | Recipient read your messages | `readBy`, `readByUsername`, `readAt` |
| `mark_read_success` | Confirmation of marking messages read | `senderId`, `markedCount` |
| `typing_indicator` | Someone is typing | `userId`, `username`, `isTyping` |
| `online_users` | Updated list of online users | `users[]`, `totalOnline` |
| `user_online` | A user came online | `userId`, `username` |
| `user_offline` | A user went offline | `userId`, `username` |
| `error` | Error message | `message`, `timestamp` |

---

## Message Flow Diagrams

### Sending a Chat Message

```
┌──────────┐              ┌──────────┐              ┌──────────┐              ┌──────────┐
│  Sender  │              │  Server  │              │ Receiver │              │ Database │
└────┬─────┘              └────┬─────┘              └────┬─────┘              └────┬─────┘
     │                         │                         │                         │
     │  1. chat_message        │                         │                         │
     │  {receiverId, content}  │                         │                         │
     │ ───────────────────────>│                         │                         │
     │                         │                         │                         │
     │                         │  2. Save message        │                         │
     │                         │ ─────────────────────────────────────────────────>│
     │                         │                         │                         │
     │                         │  3. Message saved       │                         │
     │                         │ <─────────────────────────────────────────────────│
     │                         │                         │                         │
     │  4. message_sent        │                         │                         │
     │  {messageId, status}    │                         │                         │
     │ <───────────────────────│                         │                         │
     │                         │                         │                         │
     │                         │  5. new_message         │                         │
     │                         │  (if receiver online)   │                         │
     │                         │ ───────────────────────>│                         │
     │                         │                         │                         │
     │                         │  6. Update to delivered │                         │
     │                         │ ─────────────────────────────────────────────────>│
     │                         │                         │                         │
     │  7. message_delivered   │                         │                         │
     │ <───────────────────────│                         │                         │
```

### Typing Indicator Flow

```
┌──────────┐              ┌──────────┐              ┌──────────┐
│  Sender  │              │  Server  │              │ Receiver │
└────┬─────┘              └────┬─────┘              └────┬─────┘
     │                         │                         │
     │  typing_start           │                         │
     │  {receiverId}           │                         │
     │ ───────────────────────>│                         │
     │                         │                         │
     │                         │  typing_indicator       │
     │                         │  {isTyping: true}       │
     │                         │ ───────────────────────>│
     │                         │                         │
     │   ... user types ...    │                         │
     │                         │                         │
     │  typing_stop            │                         │
     │  {receiverId}           │                         │
     │ ───────────────────────>│                         │
     │                         │                         │
     │                         │  typing_indicator       │
     │                         │  {isTyping: false}      │
     │                         │ ───────────────────────>│
```

### Mark Messages as Read

```
┌──────────┐              ┌──────────┐              ┌──────────┐              ┌──────────┐
│ Receiver │              │  Server  │              │  Sender  │              │ Database │
└────┬─────┘              └────┬─────┘              └────┬─────┘              └────┬─────┘
     │                         │                         │                         │
     │  mark_read              │                         │                         │
     │  {senderId}             │                         │                         │
     │ ───────────────────────>│                         │                         │
     │                         │                         │                         │
     │                         │  Update messages        │                         │
     │                         │ ─────────────────────────────────────────────────>│
     │                         │                         │                         │
     │                         │  messages_read          │                         │
     │                         │ ───────────────────────>│                         │
     │                         │                         │                         │
     │  mark_read_success      │                         │                         │
     │ <───────────────────────│                         │                         │
```

---

## Error Handling

### Connection Errors

| Error Code | Reason | Description |
|------------|--------|-------------|
| 4001 | Authentication required | No token provided |
| 4002 | Invalid token | JWT verification failed |
| 4003 | User not found | User doesn't exist in database |
| 4004 | Server error | Database error during authentication |
| 4005 | New connection established | Old connection closed for same user |

### Message Errors

Error messages are sent with type `error`:

```json
{
  "type": "error",
  "data": {
    "message": "Error description",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

Common error messages:
- "Missing required fields: receiverId and content"
- "Cannot send message to yourself"
- "Invalid message format. Please send valid JSON."
- "Unknown message type: {type}"

---

## Connection Management

### Heartbeat Mechanism

The server implements a ping-pong heartbeat to detect dead connections:

```
┌──────────┐                              ┌──────────┐
│  Client  │                              │  Server  │
└────┬─────┘                              └────┬─────┘
     │                                         │
     │           Every 30 seconds              │
     │ <─────────────── PING ──────────────────│
     │                                         │
     │ ─────────────── PONG ──────────────────>│
     │                                         │
     │    If no PONG within 30s               │
     │    Connection terminated               │
```

### Disconnection Flow

```
┌──────────┐              ┌──────────┐              ┌──────────┐              ┌──────────┐
│  Client  │              │  Server  │              │  Others  │              │ Database │
└────┬─────┘              └────┬─────┘              └────┬─────┘              └────┬─────┘
     │                         │                         │                         │
     │  Connection closed      │                         │                         │
     │ ───────────────────────>│                         │                         │
     │                         │                         │                         │
     │                         │  Remove from map        │                         │
     │                         │                         │                         │
     │                         │  Update isOnline=false  │                         │
     │                         │  Update lastSeen        │                         │
     │                         │ ─────────────────────────────────────────────────>│
     │                         │                         │                         │
     │                         │  user_offline           │                         │
     │                         │ ───────────────────────>│                         │
     │                         │                         │                         │
     │                         │  online_users (updated) │                         │
     │                         │ ───────────────────────>│                         │
```

---

## Message Format Examples

### Client Sending a Message

```json
{
  "type": "chat_message",
  "data": {
    "receiverId": "507f1f77bcf86cd799439011",
    "content": "Hello! How are you?",
    "messageType": "text"
  }
}
```

### Server Delivering a Message

```json
{
  "type": "new_message",
  "data": {
    "messageId": "507f1f77bcf86cd799439012",
    "senderId": "507f1f77bcf86cd799439010",
    "senderUsername": "john_doe",
    "content": "Hello! How are you?",
    "messageType": "text",
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### Online Users Update

```json
{
  "type": "online_users",
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439010",
        "username": "john_doe",
        "avatar": null
      },
      {
        "_id": "507f1f77bcf86cd799439011",
        "username": "jane_doe",
        "avatar": "https://example.com/avatar.jpg"
      }
    ],
    "totalOnline": 2,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## Security Considerations

1. **JWT Authentication**: All WebSocket connections require a valid JWT token
2. **One Connection Per User**: Multiple connections from the same user will close older connections
3. **Message Validation**: All incoming messages are validated before processing
4. **Error Isolation**: Errors in one connection don't affect others

---

## Performance Notes

1. **In-Memory Client Storage**: Connected clients are stored in memory for fast lookup
2. **Database Persistence**: All messages are persisted to MongoDB
3. **Selective Broadcasting**: Status updates are only sent to relevant clients
4. **Connection Pooling**: MongoDB connection pooling is handled by Mongoose
