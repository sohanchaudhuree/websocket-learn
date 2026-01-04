# WebSocket Chat Application

A clean, well-structured Express.js backend with WebSocket support for real-time one-to-one chat. This application enables instant message delivery, tracks online users, and persists all data in MongoDB.

## Features

- ✅ **Real-time one-to-one chat** via WebSocket
- ✅ **Online user tracking** - See who's online and total active users
- ✅ **Instant message delivery** - Messages delivered instantly to online users
- ✅ **Typing indicators** - Know when someone is typing
- ✅ **Read receipts** - Track when messages are read
- ✅ **Message persistence** - All messages saved to MongoDB
- ✅ **JWT authentication** - Secure token-based authentication
- ✅ **Well-documented WebSocket logic** - Isolated and easy to understand

## Tech Stack

- **Backend**: Node.js, Express.js
- **WebSocket**: ws library
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB running locally or a MongoDB Atlas URI

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sohanchaudhuree/websocket-learn.git
   cd websocket-learn
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and JWT secret
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access the API**
   - REST API: `http://localhost:3000/api`
   - WebSocket: `ws://localhost:3000/ws`
   - Health Check: `http://localhost:3000/health`

## Project Structure

```
websocket-learn/
├── src/
│   ├── config/
│   │   └── database.js       # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js # Authentication logic
│   │   ├── userController.js # User operations
│   │   └── messageController.js # Message operations
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   └── errorHandler.js   # Error handling
│   ├── models/
│   │   ├── User.js           # User schema
│   │   ├── Message.js        # Message schema
│   │   └── index.js          # Model exports
│   ├── routes/
│   │   ├── authRoutes.js     # Auth endpoints
│   │   ├── userRoutes.js     # User endpoints
│   │   ├── messageRoutes.js  # Message endpoints
│   │   └── index.js          # Route exports
│   ├── websocket/
│   │   └── index.js          # WebSocket server (fully documented)
│   └── server.js             # Main entry point
├── docs/
│   ├── WEBSOCKET_ARCHITECTURE.md    # WebSocket architecture
│   ├── REST_API_DOCUMENTATION.md    # REST API docs
│   ├── REACT_INTEGRATION_GUIDE.md   # React integration
│   └── FLUTTER_INTEGRATION_GUIDE.md # Flutter integration
├── postman/
│   ├── REST_API_Collection.json     # REST API Postman collection
│   └── WebSocket_Collection.json    # WebSocket Postman collection
├── .env.example              # Environment template
├── .gitignore
├── package.json
└── README.md
```

## Documentation

| Document | Description |
|----------|-------------|
| [WebSocket Architecture](docs/WEBSOCKET_ARCHITECTURE.md) | Detailed WebSocket architecture and message flow |
| [REST API Documentation](docs/REST_API_DOCUMENTATION.md) | Complete REST API documentation |
| [React Integration Guide](docs/REACT_INTEGRATION_GUIDE.md) | Step-by-step React integration |
| [Flutter Integration Guide](docs/FLUTTER_INTEGRATION_GUIDE.md) | Step-by-step Flutter integration |

## API Overview

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/users` | Get all users |
| GET | `/api/users/online` | Get online users |
| GET | `/api/messages/:userId` | Get conversation |
| POST | `/api/messages` | Send message (REST) |

### WebSocket Messages

**Client → Server:**
- `chat_message` - Send a message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `mark_read` - Mark messages as read

**Server → Client:**
- `new_message` - New message received
- `online_users` - Online users list
- `typing_indicator` - Typing status
- `user_online` / `user_offline` - User status changes

## Testing

### With Postman

1. Import `postman/REST_API_Collection.json` for REST API testing
2. Import `postman/WebSocket_Collection.json` for WebSocket testing (requires Postman v8+)

### With wscat (Command Line)

```bash
# Install wscat
npm install -g wscat

# Connect (replace YOUR_TOKEN with actual JWT)
wscat -c "ws://localhost:3000/ws?token=YOUR_TOKEN"

# Send a message
{"type":"chat_message","data":{"receiverId":"USER_ID","content":"Hello!"}}
```

### With Browser DevTools

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=YOUR_TOKEN');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({
  type: 'chat_message',
  data: { receiverId: 'USER_ID', content: 'Hello!' }
}));
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `MONGODB_URI` | MongoDB connection URI | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | Token expiration | 7d |
| `CORS_ORIGIN` | Allowed CORS origin | * |

## License

ISC

## Author

Created for learning WebSocket implementation with Express.js and MongoDB.