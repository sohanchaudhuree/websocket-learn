# React WebSocket Integration Guide

Step-by-step guide to integrate the WebSocket chat functionality into a React application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [WebSocket Hook](#websocket-hook)
4. [Authentication Flow](#authentication-flow)
5. [Chat Components](#chat-components)
6. [Full Example Application](#full-example-application)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ installed
- React 18+ project (Create React App, Vite, or Next.js)
- Backend server running at `http://localhost:3000`
- Basic understanding of React hooks

---

## Project Setup

### 1. Create a New React Project (if needed)

```bash
# Using Vite (recommended)
npm create vite@latest chat-app -- --template react
cd chat-app
npm install

# Or using Create React App
npx create-react-app chat-app
cd chat-app
```

### 2. Install Required Dependencies

```bash
npm install axios
```

Note: We'll use the native WebSocket API (no additional library needed).

### 3. Project Structure

```
src/
├── components/
│   ├── Chat/
│   │   ├── ChatWindow.jsx
│   │   ├── MessageList.jsx
│   │   ├── MessageInput.jsx
│   │   └── UserList.jsx
│   └── Auth/
│       ├── Login.jsx
│       └── Register.jsx
├── hooks/
│   └── useWebSocket.js
├── context/
│   ├── AuthContext.jsx
│   └── ChatContext.jsx
├── services/
│   └── api.js
├── App.jsx
└── main.jsx
```

---

## WebSocket Hook

Create a custom hook to manage WebSocket connections.

### `src/hooks/useWebSocket.js`

```javascript
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for WebSocket connection management
 * 
 * @param {string} url - WebSocket server URL
 * @param {string} token - JWT authentication token
 * @returns {Object} WebSocket state and methods
 */
export const useWebSocket = (url, token) => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  // Data state
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  
  // WebSocket reference (persists across re-renders)
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Don't connect without a token
    if (!token) {
      console.log('No token provided, skipping WebSocket connection');
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Create WebSocket connection with token
    const wsUrl = `${url}?token=${token}`;
    console.log('Connecting to WebSocket:', url);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Connection opened
    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
    };

    // Listen for messages
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Connection closed
    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;

      // Attempt reconnection (unless intentionally closed)
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`Reconnecting in ${delay}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    // Connection error
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionError('Connection failed');
    };
  }, [url, token]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((message) => {
    const { type, data } = message;

    switch (type) {
      case 'connection_established':
        console.log('Connection established:', data);
        break;

      case 'online_users':
        setOnlineUsers(data.users);
        break;

      case 'user_online':
        setOnlineUsers((prev) => {
          // Add user if not already in list
          if (!prev.find((u) => u._id === data.userId)) {
            return [...prev, { _id: data.userId, username: data.username }];
          }
          return prev;
        });
        break;

      case 'user_offline':
        setOnlineUsers((prev) => prev.filter((u) => u._id !== data.userId));
        break;

      case 'new_message':
        setMessages((prev) => [...prev, {
          _id: data.messageId,
          sender: { _id: data.senderId, username: data.senderUsername },
          content: data.content,
          messageType: data.messageType,
          createdAt: data.createdAt,
          isIncoming: true,
        }]);
        break;

      case 'message_sent':
        // Update message status
        console.log('Message sent:', data);
        break;

      case 'message_delivered':
        // Update message delivery status
        console.log('Message delivered:', data);
        break;

      case 'messages_read':
        // Update read status for messages
        console.log('Messages read by:', data.readByUsername);
        break;

      case 'typing_indicator':
        setTypingUsers((prev) => ({
          ...prev,
          [data.userId]: data.isTyping ? data.username : null,
        }));
        // Auto-remove typing indicator after 3 seconds
        if (data.isTyping) {
          setTimeout(() => {
            setTypingUsers((prev) => ({
              ...prev,
              [data.userId]: null,
            }));
          }, 3000);
        }
        break;

      case 'error':
        console.error('WebSocket error:', data.message);
        setConnectionError(data.message);
        break;

      default:
        console.log('Unknown message type:', type, data);
    }
  }, []);

  /**
   * Send a chat message
   */
  const sendMessage = useCallback((receiverId, content, messageType = 'text') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return false;
    }

    const message = {
      type: 'chat_message',
      data: {
        receiverId,
        content,
        messageType,
      },
    };

    wsRef.current.send(JSON.stringify(message));
    
    // Add message to local state immediately (optimistic update)
    setMessages((prev) => [...prev, {
      _id: `temp-${Date.now()}`,
      sender: { _id: 'me' },
      receiver: { _id: receiverId },
      content,
      messageType,
      createdAt: new Date().toISOString(),
      isOutgoing: true,
    }]);

    return true;
  }, []);

  /**
   * Send typing indicator
   */
  const sendTypingStart = useCallback((receiverId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'typing_start',
      data: { receiverId },
    }));
  }, []);

  const sendTypingStop = useCallback((receiverId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'typing_stop',
      data: { receiverId },
    }));
  }, []);

  /**
   * Mark messages as read
   */
  const markAsRead = useCallback((senderId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'mark_read',
      data: { senderId },
    }));
  }, []);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User logout');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Connect when component mounts or token changes
  useEffect(() => {
    if (token) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  // Clear messages when starting a new conversation
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    // State
    isConnected,
    connectionError,
    onlineUsers,
    messages,
    typingUsers,
    
    // Methods
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    markAsRead,
    clearMessages,
    connect,
    disconnect,
  };
};

export default useWebSocket;
```

---

## Authentication Flow

### `src/services/api.js`

```javascript
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Users API
export const usersAPI = {
  getAll: (page = 1, limit = 20) => 
    api.get(`/users?page=${page}&limit=${limit}`),
  getOnline: () => api.get('/users/online'),
  search: (query) => api.get(`/users/search?query=${query}`),
  getById: (id) => api.get(`/users/${id}`),
};

// Messages API
export const messagesAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getConversation: (userId, page = 1, limit = 50) =>
    api.get(`/messages/${userId}?page=${page}&limit=${limit}`),
  send: (data) => api.post('/messages', data),
  markAsRead: (userId) => api.put(`/messages/read/${userId}`),
  getUnreadCount: () => api.get('/messages/unread/count'),
};

export default api;
```

### `src/context/AuthContext.jsx`

```javascript
import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data.data.user);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { user, token } = response.data.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    return user;
  };

  const register = async (username, email, password) => {
    const response = await authAPI.register({ username, email, password });
    const { user, token } = response.data.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

## Chat Components

### `src/components/Chat/UserList.jsx`

```javascript
import { useState, useEffect } from 'react';
import { usersAPI } from '../../services/api';

const UserList = ({ onlineUsers, onSelectUser, selectedUserId }) => {
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await usersAPI.getAll();
        setAllUsers(response.data.data.users);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  // Merge online status into all users
  const usersWithStatus = allUsers.map((user) => ({
    ...user,
    isOnline: onlineUsers.some((ou) => ou._id === user._id),
  }));

  // Sort: online users first
  const sortedUsers = usersWithStatus.sort((a, b) => b.isOnline - a.isOnline);

  return (
    <div className="user-list">
      <h3>Users ({onlineUsers.length} online)</h3>
      <ul>
        {sortedUsers.map((user) => (
          <li
            key={user._id}
            onClick={() => onSelectUser(user)}
            className={`user-item ${selectedUserId === user._id ? 'selected' : ''}`}
          >
            <span className={`status-dot ${user.isOnline ? 'online' : 'offline'}`} />
            <span className="username">{user.username}</span>
          </li>
        ))}
      </ul>
      
      <style>{`
        .user-list {
          width: 250px;
          border-right: 1px solid #ddd;
          padding: 10px;
        }
        .user-item {
          display: flex;
          align-items: center;
          padding: 10px;
          cursor: pointer;
          border-radius: 5px;
        }
        .user-item:hover {
          background: #f0f0f0;
        }
        .user-item.selected {
          background: #e0e0ff;
        }
        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 10px;
        }
        .status-dot.online {
          background: #4caf50;
        }
        .status-dot.offline {
          background: #9e9e9e;
        }
      `}</style>
    </div>
  );
};

export default UserList;
```

### `src/components/Chat/MessageList.jsx`

```javascript
import { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

const MessageList = ({ messages, typingUsers, selectedUser }) => {
  const { user } = useAuth();
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Filter messages for current conversation
  const conversationMessages = messages.filter(
    (msg) =>
      (msg.sender?._id === selectedUser?._id) ||
      (msg.receiver?._id === selectedUser?._id) ||
      msg.isOutgoing
  );

  const isTyping = selectedUser && typingUsers[selectedUser._id];

  return (
    <div className="message-list">
      {conversationMessages.map((message) => {
        const isMyMessage = message.isOutgoing || message.sender?._id === user?._id;
        
        return (
          <div
            key={message._id}
            className={`message ${isMyMessage ? 'outgoing' : 'incoming'}`}
          >
            <div className="message-content">{message.content}</div>
            <div className="message-time">
              {new Date(message.createdAt).toLocaleTimeString()}
            </div>
          </div>
        );
      })}
      
      {isTyping && (
        <div className="typing-indicator">
          {selectedUser.username} is typing...
        </div>
      )}
      
      <div ref={messagesEndRef} />
      
      <style>{`
        .message-list {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .message {
          max-width: 70%;
          margin-bottom: 10px;
          padding: 10px 15px;
          border-radius: 15px;
        }
        .message.outgoing {
          margin-left: auto;
          background: #007bff;
          color: white;
        }
        .message.incoming {
          background: #e9ecef;
        }
        .message-time {
          font-size: 0.7em;
          opacity: 0.7;
          margin-top: 5px;
        }
        .typing-indicator {
          color: #888;
          font-style: italic;
          padding: 5px 15px;
        }
      `}</style>
    </div>
  );
};

export default MessageList;
```

### `src/components/Chat/MessageInput.jsx`

```javascript
import { useState, useRef, useEffect } from 'react';

const MessageInput = ({ onSend, onTypingStart, onTypingStop, disabled }) => {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const handleInputChange = (e) => {
    setMessage(e.target.value);

    // Send typing start if not already typing
    if (!isTypingRef.current && e.target.value) {
      isTypingRef.current = true;
      onTypingStart?.();
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingStop?.();
      }
    }, 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      
      // Stop typing indicator
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingStop?.();
      }
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="message-input">
      <input
        type="text"
        value={message}
        onChange={handleInputChange}
        placeholder={disabled ? "Select a user to chat" : "Type a message..."}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !message.trim()}>
        Send
      </button>
      
      <style>{`
        .message-input {
          display: flex;
          padding: 10px;
          border-top: 1px solid #ddd;
        }
        .message-input input {
          flex: 1;
          padding: 10px 15px;
          border: 1px solid #ddd;
          border-radius: 20px;
          margin-right: 10px;
        }
        .message-input button {
          padding: 10px 20px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 20px;
          cursor: pointer;
        }
        .message-input button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
};

export default MessageInput;
```

### `src/components/Chat/ChatWindow.jsx`

```javascript
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import useWebSocket from '../../hooks/useWebSocket';
import { messagesAPI } from '../../services/api';
import UserList from './UserList';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

const WS_URL = 'ws://localhost:3000/ws';

const ChatWindow = () => {
  const { user, token, logout } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null);
  
  const {
    isConnected,
    connectionError,
    onlineUsers,
    messages,
    typingUsers,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    markAsRead,
    clearMessages,
  } = useWebSocket(WS_URL, token);

  // Load conversation history when selecting a user
  useEffect(() => {
    const loadHistory = async () => {
      if (selectedUser) {
        try {
          const response = await messagesAPI.getConversation(selectedUser._id);
          // Note: In a real app, you'd merge this with WebSocket messages
          console.log('Loaded history:', response.data.data.messages);
        } catch (error) {
          console.error('Error loading conversation:', error);
        }
      }
    };

    clearMessages();
    loadHistory();
  }, [selectedUser, clearMessages]);

  // Mark messages as read when selecting a user
  useEffect(() => {
    if (selectedUser && isConnected) {
      markAsRead(selectedUser._id);
    }
  }, [selectedUser, isConnected, markAsRead]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
  };

  const handleSendMessage = (content) => {
    if (selectedUser) {
      sendMessage(selectedUser._id, content);
    }
  };

  const handleTypingStart = () => {
    if (selectedUser) {
      sendTypingStart(selectedUser._id);
    }
  };

  const handleTypingStop = () => {
    if (selectedUser) {
      sendTypingStop(selectedUser._id);
    }
  };

  return (
    <div className="chat-window">
      <header className="chat-header">
        <span>Welcome, {user?.username}!</span>
        <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </span>
        <button onClick={logout}>Logout</button>
      </header>

      {connectionError && (
        <div className="error-banner">{connectionError}</div>
      )}

      <div className="chat-body">
        <UserList
          onlineUsers={onlineUsers}
          onSelectUser={handleSelectUser}
          selectedUserId={selectedUser?._id}
        />
        
        <div className="chat-main">
          {selectedUser ? (
            <>
              <div className="chat-header-user">
                <strong>{selectedUser.username}</strong>
                <span className={selectedUser.isOnline ? 'online' : 'offline'}>
                  {onlineUsers.some(u => u._id === selectedUser._id) ? 'Online' : 'Offline'}
                </span>
              </div>
              
              <MessageList
                messages={messages}
                typingUsers={typingUsers}
                selectedUser={selectedUser}
              />
              
              <MessageInput
                onSend={handleSendMessage}
                onTypingStart={handleTypingStart}
                onTypingStop={handleTypingStop}
                disabled={!isConnected}
              />
            </>
          ) : (
            <div className="no-selection">
              Select a user to start chatting
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .chat-window {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background: #007bff;
          color: white;
        }
        .connection-status.connected { color: #90EE90; }
        .connection-status.disconnected { color: #ffcccb; }
        .error-banner {
          background: #ffcccb;
          padding: 10px;
          text-align: center;
        }
        .chat-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .chat-header-user {
          padding: 15px 20px;
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
        }
        .chat-header-user .online { color: #4caf50; }
        .chat-header-user .offline { color: #9e9e9e; }
        .no-selection {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          color: #888;
        }
      `}</style>
    </div>
  );
};

export default ChatWindow;
```

---

## Full Example Application

### `src/App.jsx`

```javascript
import { AuthProvider, useAuth } from './context/AuthContext';
import ChatWindow from './components/Chat/ChatWindow';
import Login from './components/Auth/Login';

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return user ? <ChatWindow /> : <Login />;
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
```

### `src/components/Auth/Login.jsx`

```javascript
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.username, formData.email, formData.password);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>{isLogin ? 'Login' : 'Register'}</h2>
        
        {error && <div className="error">{error}</div>}
        
        {!isLogin && (
          <input
            type="text"
            placeholder="Username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required={!isLogin}
          />
        )}
        
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
        </button>
        
        <p>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button type="button" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </form>
      
      <style>{`
        .login-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: #f0f2f5;
        }
        .login-form {
          background: white;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          width: 300px;
        }
        .login-form h2 {
          text-align: center;
          margin-bottom: 20px;
        }
        .login-form input {
          width: 100%;
          padding: 12px;
          margin-bottom: 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
          box-sizing: border-box;
        }
        .login-form button[type="submit"] {
          width: 100%;
          padding: 12px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
        }
        .login-form button[type="submit"]:disabled {
          background: #ccc;
        }
        .login-form .error {
          background: #ffcccb;
          padding: 10px;
          border-radius: 5px;
          margin-bottom: 15px;
          text-align: center;
        }
        .login-form p {
          text-align: center;
          margin-top: 15px;
        }
        .login-form p button {
          background: none;
          border: none;
          color: #007bff;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default Login;
```

---

## Best Practices

### 1. Connection Management

```javascript
// Always clean up WebSocket connections
useEffect(() => {
  return () => {
    if (ws.current) {
      ws.current.close(1000, 'Component unmounted');
    }
  };
}, []);
```

### 2. Reconnection with Exponential Backoff

```javascript
const reconnect = () => {
  const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
  setTimeout(connect, delay);
  attempts++;
};
```

### 3. Optimistic Updates

```javascript
// Add message to UI immediately, then confirm with server
setMessages(prev => [...prev, newMessage]);
ws.send(JSON.stringify(newMessage));
```

### 4. Error Handling

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  showErrorNotification('Connection error. Reconnecting...');
};
```

### 5. Message Queue for Offline

```javascript
// Queue messages when offline
if (ws.readyState !== WebSocket.OPEN) {
  messageQueue.push(message);
  return;
}
// Send queued messages when reconnected
```

---

## Troubleshooting

### Connection Issues

1. **"WebSocket connection failed"**
   - Check if the server is running
   - Verify the WebSocket URL is correct
   - Ensure CORS is configured properly

2. **"Authentication required"**
   - Make sure you're passing the token in the URL query
   - Check if the token has expired

3. **Messages not appearing**
   - Verify the message format matches the server's expected format
   - Check browser console for parsing errors

### Performance Issues

1. **Slow message delivery**
   - Check network latency
   - Reduce message payload size

2. **Memory leaks**
   - Ensure WebSocket is closed on component unmount
   - Clear message arrays periodically for long conversations

### Debugging Tips

```javascript
// Enable verbose logging
ws.onmessage = (event) => {
  console.log('Received:', event.data);
  // ... handle message
};

ws.onopen = () => console.log('Connected');
ws.onclose = (e) => console.log('Closed:', e.code, e.reason);
ws.onerror = (e) => console.error('Error:', e);
```

---

## Next Steps

1. Add push notifications for new messages
2. Implement message persistence with IndexedDB
3. Add file/image sharing
4. Implement message search
5. Add group chat support
