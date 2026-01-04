# Flutter WebSocket Integration Guide

Step-by-step guide to integrate the WebSocket chat functionality into a Flutter application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [WebSocket Service](#websocket-service)
4. [Authentication](#authentication)
5. [Chat UI Components](#chat-ui-components)
6. [Full Example Application](#full-example-application)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Flutter SDK 3.0+ installed
- Dart 3.0+
- Backend server running at `http://localhost:3000`
- Basic understanding of Flutter and Provider/BLoC

---

## Project Setup

### 1. Create a New Flutter Project

```bash
flutter create chat_app
cd chat_app
```

### 2. Add Dependencies

Update your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  web_socket_channel: ^2.4.0
  http: ^1.1.0
  provider: ^6.1.1
  shared_preferences: ^2.2.2
  intl: ^0.18.1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
```

Run:
```bash
flutter pub get
```

### 3. Project Structure

```
lib/
├── main.dart
├── models/
│   ├── user.dart
│   └── message.dart
├── services/
│   ├── api_service.dart
│   ├── auth_service.dart
│   └── websocket_service.dart
├── providers/
│   ├── auth_provider.dart
│   └── chat_provider.dart
├── screens/
│   ├── login_screen.dart
│   ├── register_screen.dart
│   └── chat_screen.dart
└── widgets/
    ├── user_list.dart
    ├── message_list.dart
    └── message_input.dart
```

---

## Data Models

### `lib/models/user.dart`

```dart
class User {
  final String id;
  final String username;
  final String email;
  final String? avatar;
  final bool isOnline;
  final DateTime? lastSeen;

  User({
    required this.id,
    required this.username,
    required this.email,
    this.avatar,
    this.isOnline = false,
    this.lastSeen,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      avatar: json['avatar'],
      isOnline: json['isOnline'] ?? false,
      lastSeen: json['lastSeen'] != null
          ? DateTime.parse(json['lastSeen'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'username': username,
      'email': email,
      'avatar': avatar,
      'isOnline': isOnline,
      'lastSeen': lastSeen?.toIso8601String(),
    };
  }

  User copyWith({
    String? id,
    String? username,
    String? email,
    String? avatar,
    bool? isOnline,
    DateTime? lastSeen,
  }) {
    return User(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      avatar: avatar ?? this.avatar,
      isOnline: isOnline ?? this.isOnline,
      lastSeen: lastSeen ?? this.lastSeen,
    );
  }
}
```

### `lib/models/message.dart`

```dart
class Message {
  final String id;
  final String senderId;
  final String? senderUsername;
  final String receiverId;
  final String content;
  final String messageType;
  final bool isRead;
  final DateTime createdAt;
  final bool isOutgoing;

  Message({
    required this.id,
    required this.senderId,
    this.senderUsername,
    required this.receiverId,
    required this.content,
    this.messageType = 'text',
    this.isRead = false,
    required this.createdAt,
    this.isOutgoing = false,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['_id'] ?? json['messageId'] ?? '',
      senderId: json['sender'] is Map 
          ? json['sender']['_id'] 
          : json['senderId'] ?? '',
      senderUsername: json['sender'] is Map 
          ? json['sender']['username'] 
          : json['senderUsername'],
      receiverId: json['receiver'] is Map 
          ? json['receiver']['_id'] 
          : json['receiverId'] ?? '',
      content: json['content'] ?? '',
      messageType: json['messageType'] ?? 'text',
      isRead: json['isRead'] ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  Message copyWith({
    String? id,
    String? senderId,
    String? senderUsername,
    String? receiverId,
    String? content,
    String? messageType,
    bool? isRead,
    DateTime? createdAt,
    bool? isOutgoing,
  }) {
    return Message(
      id: id ?? this.id,
      senderId: senderId ?? this.senderId,
      senderUsername: senderUsername ?? this.senderUsername,
      receiverId: receiverId ?? this.receiverId,
      content: content ?? this.content,
      messageType: messageType ?? this.messageType,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
      isOutgoing: isOutgoing ?? this.isOutgoing,
    );
  }
}
```

---

## WebSocket Service

### `lib/services/websocket_service.dart`

```dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/user.dart';
import '../models/message.dart';

/// WebSocket message types
enum WSMessageType {
  connectionEstablished,
  onlineUsers,
  userOnline,
  userOffline,
  newMessage,
  messageSent,
  messageDelivered,
  messagesRead,
  typingIndicator,
  markReadSuccess,
  error,
}

/// WebSocket event callback types
typedef OnMessageCallback = void Function(Message message);
typedef OnOnlineUsersCallback = void Function(List<User> users, int total);
typedef OnUserStatusCallback = void Function(String userId, String username, bool isOnline);
typedef OnTypingCallback = void Function(String userId, String username, bool isTyping);
typedef OnErrorCallback = void Function(String error);
typedef OnConnectionCallback = void Function(bool connected);

/// WebSocket Service for managing real-time chat connections
class WebSocketService {
  static const String _wsUrl = 'ws://10.0.2.2:3000/ws'; // Android emulator
  // static const String _wsUrl = 'ws://localhost:3000/ws'; // iOS simulator
  // static const String _wsUrl = 'ws://YOUR_SERVER_IP:3000/ws'; // Physical device

  WebSocketChannel? _channel;
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  int _reconnectAttempts = 0;
  final int _maxReconnectAttempts = 5;
  
  String? _token;
  bool _isConnected = false;
  bool _isConnecting = false;

  // Callbacks
  OnMessageCallback? onNewMessage;
  OnOnlineUsersCallback? onOnlineUsers;
  OnUserStatusCallback? onUserStatus;
  OnTypingCallback? onTyping;
  OnErrorCallback? onError;
  OnConnectionCallback? onConnectionChange;

  // Getters
  bool get isConnected => _isConnected;

  /// Initialize and connect to WebSocket server
  Future<void> connect(String token) async {
    if (_isConnecting || _isConnected) {
      debugPrint('WebSocket: Already connected or connecting');
      return;
    }

    _token = token;
    _isConnecting = true;

    try {
      final uri = Uri.parse('$_wsUrl?token=$token');
      debugPrint('WebSocket: Connecting to $uri');

      _channel = WebSocketChannel.connect(uri);
      
      // Listen for messages
      _channel!.stream.listen(
        _handleMessage,
        onError: _handleError,
        onDone: _handleDone,
        cancelOnError: false,
      );

      _isConnected = true;
      _isConnecting = false;
      _reconnectAttempts = 0;
      onConnectionChange?.call(true);

      // Start ping timer to keep connection alive
      _startPingTimer();

      debugPrint('WebSocket: Connected successfully');
    } catch (e) {
      debugPrint('WebSocket: Connection error - $e');
      _isConnecting = false;
      onError?.call('Connection failed: $e');
      _scheduleReconnect();
    }
  }

  /// Handle incoming WebSocket messages
  void _handleMessage(dynamic data) {
    try {
      final Map<String, dynamic> message = jsonDecode(data.toString());
      final String type = message['type'] ?? '';
      final Map<String, dynamic>? messageData = message['data'];

      debugPrint('WebSocket: Received message type: $type');

      switch (type) {
        case 'connection_established':
          debugPrint('WebSocket: Connection established for user ${messageData?['username']}');
          break;

        case 'online_users':
          final users = (messageData?['users'] as List?)
              ?.map((u) => User.fromJson(u))
              .toList() ?? [];
          final total = messageData?['totalOnline'] ?? 0;
          onOnlineUsers?.call(users, total);
          break;

        case 'user_online':
          onUserStatus?.call(
            messageData?['userId'] ?? '',
            messageData?['username'] ?? '',
            true,
          );
          break;

        case 'user_offline':
          onUserStatus?.call(
            messageData?['userId'] ?? '',
            messageData?['username'] ?? '',
            false,
          );
          break;

        case 'new_message':
          if (messageData != null) {
            final msg = Message.fromJson(messageData);
            onNewMessage?.call(msg);
          }
          break;

        case 'message_sent':
          debugPrint('WebSocket: Message sent - ${messageData?['messageId']}');
          break;

        case 'message_delivered':
          debugPrint('WebSocket: Message delivered - ${messageData?['messageId']}');
          break;

        case 'messages_read':
          debugPrint('WebSocket: Messages read by ${messageData?['readByUsername']}');
          break;

        case 'typing_indicator':
          onTyping?.call(
            messageData?['userId'] ?? '',
            messageData?['username'] ?? '',
            messageData?['isTyping'] ?? false,
          );
          break;

        case 'error':
          final errorMsg = messageData?['message'] ?? 'Unknown error';
          debugPrint('WebSocket: Error - $errorMsg');
          onError?.call(errorMsg);
          break;

        default:
          debugPrint('WebSocket: Unknown message type - $type');
      }
    } catch (e) {
      debugPrint('WebSocket: Error parsing message - $e');
    }
  }

  /// Handle WebSocket errors
  void _handleError(dynamic error) {
    debugPrint('WebSocket: Error - $error');
    _isConnected = false;
    onConnectionChange?.call(false);
    onError?.call(error.toString());
  }

  /// Handle WebSocket connection closed
  void _handleDone() {
    debugPrint('WebSocket: Connection closed');
    _isConnected = false;
    _stopPingTimer();
    onConnectionChange?.call(false);
    _scheduleReconnect();
  }

  /// Schedule reconnection with exponential backoff
  void _scheduleReconnect() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      debugPrint('WebSocket: Max reconnect attempts reached');
      onError?.call('Could not reconnect to server');
      return;
    }

    _reconnectTimer?.cancel();
    
    final delay = Duration(
      milliseconds: (1000 * (1 << _reconnectAttempts)).clamp(1000, 30000),
    );
    
    debugPrint('WebSocket: Reconnecting in ${delay.inSeconds}s (attempt ${_reconnectAttempts + 1})');
    
    _reconnectTimer = Timer(delay, () {
      _reconnectAttempts++;
      if (_token != null) {
        connect(_token!);
      }
    });
  }

  /// Start ping timer for keep-alive
  void _startPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      // WebSocket ping is handled automatically by web_socket_channel
      // This timer is just for monitoring connection health
      if (!_isConnected && _token != null) {
        connect(_token!);
      }
    });
  }

  /// Stop ping timer
  void _stopPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  /// Send a chat message
  void sendMessage(String receiverId, String content, {String messageType = 'text'}) {
    if (!_isConnected) {
      debugPrint('WebSocket: Cannot send - not connected');
      onError?.call('Not connected to server');
      return;
    }

    final message = {
      'type': 'chat_message',
      'data': {
        'receiverId': receiverId,
        'content': content,
        'messageType': messageType,
      },
    };

    _send(message);
  }

  /// Send typing start indicator
  void sendTypingStart(String receiverId) {
    if (!_isConnected) return;
    
    _send({
      'type': 'typing_start',
      'data': {'receiverId': receiverId},
    });
  }

  /// Send typing stop indicator
  void sendTypingStop(String receiverId) {
    if (!_isConnected) return;
    
    _send({
      'type': 'typing_stop',
      'data': {'receiverId': receiverId},
    });
  }

  /// Mark messages from a user as read
  void markAsRead(String senderId) {
    if (!_isConnected) return;
    
    _send({
      'type': 'mark_read',
      'data': {'senderId': senderId},
    });
  }

  /// Request online users list
  void requestOnlineUsers() {
    if (!_isConnected) return;
    
    _send({'type': 'get_online_users', 'data': {}});
  }

  /// Send message to WebSocket
  void _send(Map<String, dynamic> message) {
    try {
      _channel?.sink.add(jsonEncode(message));
    } catch (e) {
      debugPrint('WebSocket: Send error - $e');
      onError?.call('Failed to send message');
    }
  }

  /// Disconnect from WebSocket
  void disconnect() {
    debugPrint('WebSocket: Disconnecting');
    _reconnectTimer?.cancel();
    _stopPingTimer();
    _channel?.sink.close();
    _channel = null;
    _isConnected = false;
    _isConnecting = false;
    _token = null;
    onConnectionChange?.call(false);
  }

  /// Dispose resources
  void dispose() {
    disconnect();
    onNewMessage = null;
    onOnlineUsers = null;
    onUserStatus = null;
    onTyping = null;
    onError = null;
    onConnectionChange = null;
  }
}
```

---

## API Service

### `lib/services/api_service.dart`

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Use 10.0.2.2 for Android emulator, localhost for iOS simulator
  static const String _baseUrl = 'http://10.0.2.2:3000/api';
  // static const String _baseUrl = 'http://localhost:3000/api'; // iOS simulator
  // static const String _baseUrl = 'http://YOUR_SERVER_IP:3000/api'; // Physical device

  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  /// POST request
  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$_baseUrl$endpoint'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  /// GET request
  Future<Map<String, dynamic>> get(String endpoint) async {
    final response = await http.get(
      Uri.parse('$_baseUrl$endpoint'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  /// PUT request
  Future<Map<String, dynamic>> put(String endpoint, Map<String, dynamic> body) async {
    final response = await http.put(
      Uri.parse('$_baseUrl$endpoint'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  /// Handle API response
  Map<String, dynamic> _handleResponse(http.Response response) {
    final data = jsonDecode(response.body);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Request failed');
    }
  }

  // Auth endpoints
  Future<Map<String, dynamic>> register(String username, String email, String password) {
    return post('/auth/register', {
      'username': username,
      'email': email,
      'password': password,
    });
  }

  Future<Map<String, dynamic>> login(String email, String password) {
    return post('/auth/login', {
      'email': email,
      'password': password,
    });
  }

  Future<Map<String, dynamic>> getMe() => get('/auth/me');

  // User endpoints
  Future<Map<String, dynamic>> getUsers({int page = 1, int limit = 20}) {
    return get('/users?page=$page&limit=$limit');
  }

  Future<Map<String, dynamic>> getOnlineUsers() => get('/users/online');

  Future<Map<String, dynamic>> searchUsers(String query) {
    return get('/users/search?query=${Uri.encodeComponent(query)}');
  }

  // Message endpoints
  Future<Map<String, dynamic>> getConversations() => get('/messages/conversations');

  Future<Map<String, dynamic>> getConversation(String userId, {int page = 1, int limit = 50}) {
    return get('/messages/$userId?page=$page&limit=$limit');
  }

  Future<Map<String, dynamic>> sendMessage(String receiverId, String content) {
    return post('/messages', {
      'receiverId': receiverId,
      'content': content,
    });
  }

  Future<Map<String, dynamic>> markAsRead(String userId) {
    return put('/messages/read/$userId', {});
  }

  Future<Map<String, dynamic>> getUnreadCount() => get('/messages/unread/count');
}

// Global API service instance
final apiService = ApiService();
```

---

## Providers

### `lib/providers/auth_provider.dart`

```dart
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  String? _token;
  bool _isLoading = true;

  User? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _token != null && _user != null;

  /// Initialize auth state from storage
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    
    if (_token != null) {
      apiService.setToken(_token);
      try {
        final response = await apiService.getMe();
        _user = User.fromJson(response['data']['user']);
      } catch (e) {
        debugPrint('Auth init error: $e');
        await logout();
      }
    }
    
    _isLoading = false;
    notifyListeners();
  }

  /// Login with email and password
  Future<void> login(String email, String password) async {
    final response = await apiService.login(email, password);
    
    _token = response['data']['token'];
    _user = User.fromJson(response['data']['user']);
    
    apiService.setToken(_token);
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', _token!);
    
    notifyListeners();
  }

  /// Register new user
  Future<void> register(String username, String email, String password) async {
    final response = await apiService.register(username, email, password);
    
    _token = response['data']['token'];
    _user = User.fromJson(response['data']['user']);
    
    apiService.setToken(_token);
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', _token!);
    
    notifyListeners();
  }

  /// Logout
  Future<void> logout() async {
    _token = null;
    _user = null;
    
    apiService.setToken(null);
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    
    notifyListeners();
  }
}
```

### `lib/providers/chat_provider.dart`

```dart
import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../models/message.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';

class ChatProvider with ChangeNotifier {
  final WebSocketService _wsService = WebSocketService();
  
  List<User> _users = [];
  List<User> _onlineUsers = [];
  List<Message> _messages = [];
  User? _selectedUser;
  Map<String, bool> _typingUsers = {};
  bool _isConnected = false;
  String? _error;

  // Getters
  List<User> get users => _users;
  List<User> get onlineUsers => _onlineUsers;
  List<Message> get messages => _messages;
  User? get selectedUser => _selectedUser;
  Map<String, bool> get typingUsers => _typingUsers;
  bool get isConnected => _isConnected;
  String? get error => _error;
  int get onlineCount => _onlineUsers.length;

  /// Initialize chat and connect to WebSocket
  Future<void> init(String token) async {
    // Set up WebSocket callbacks
    _wsService.onNewMessage = _handleNewMessage;
    _wsService.onOnlineUsers = _handleOnlineUsers;
    _wsService.onUserStatus = _handleUserStatus;
    _wsService.onTyping = _handleTyping;
    _wsService.onError = _handleError;
    _wsService.onConnectionChange = _handleConnectionChange;

    // Connect to WebSocket
    await _wsService.connect(token);

    // Load users
    await loadUsers();
  }

  /// Load all users from API
  Future<void> loadUsers() async {
    try {
      final response = await apiService.getUsers();
      _users = (response['data']['users'] as List)
          .map((u) => User.fromJson(u))
          .toList();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading users: $e');
    }
  }

  /// Select a user to chat with
  Future<void> selectUser(User? user) async {
    _selectedUser = user;
    _messages = [];
    notifyListeners();

    if (user != null) {
      await loadConversation(user.id);
      // Mark messages as read
      _wsService.markAsRead(user.id);
    }
  }

  /// Load conversation history
  Future<void> loadConversation(String userId) async {
    try {
      final response = await apiService.getConversation(userId);
      _messages = (response['data']['messages'] as List)
          .map((m) => Message.fromJson(m))
          .toList();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading conversation: $e');
    }
  }

  /// Send a message
  void sendMessage(String content) {
    if (_selectedUser == null || content.trim().isEmpty) return;

    // Add message to local list immediately (optimistic update)
    final tempMessage = Message(
      id: 'temp-${DateTime.now().millisecondsSinceEpoch}',
      senderId: 'me',
      receiverId: _selectedUser!.id,
      content: content,
      createdAt: DateTime.now(),
      isOutgoing: true,
    );
    _messages.add(tempMessage);
    notifyListeners();

    // Send via WebSocket
    _wsService.sendMessage(_selectedUser!.id, content);
  }

  /// Send typing indicator
  void sendTypingStart() {
    if (_selectedUser != null) {
      _wsService.sendTypingStart(_selectedUser!.id);
    }
  }

  void sendTypingStop() {
    if (_selectedUser != null) {
      _wsService.sendTypingStop(_selectedUser!.id);
    }
  }

  // WebSocket event handlers
  void _handleNewMessage(Message message) {
    _messages.add(message);
    // Mark as read if this is the current conversation
    if (_selectedUser?.id == message.senderId) {
      _wsService.markAsRead(message.senderId);
    }
    notifyListeners();
  }

  void _handleOnlineUsers(List<User> users, int total) {
    _onlineUsers = users;
    // Update online status in users list
    for (var i = 0; i < _users.length; i++) {
      final isOnline = users.any((u) => u.id == _users[i].id);
      if (_users[i].isOnline != isOnline) {
        _users[i] = _users[i].copyWith(isOnline: isOnline);
      }
    }
    notifyListeners();
  }

  void _handleUserStatus(String userId, String username, bool isOnline) {
    if (isOnline) {
      if (!_onlineUsers.any((u) => u.id == userId)) {
        _onlineUsers.add(User(id: userId, username: username, email: '', isOnline: true));
      }
    } else {
      _onlineUsers.removeWhere((u) => u.id == userId);
    }
    // Update in users list
    final index = _users.indexWhere((u) => u.id == userId);
    if (index != -1) {
      _users[index] = _users[index].copyWith(isOnline: isOnline);
    }
    notifyListeners();
  }

  void _handleTyping(String userId, String username, bool isTyping) {
    _typingUsers[userId] = isTyping;
    notifyListeners();
  }

  void _handleError(String error) {
    _error = error;
    notifyListeners();
    // Clear error after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      _error = null;
      notifyListeners();
    });
  }

  void _handleConnectionChange(bool connected) {
    _isConnected = connected;
    notifyListeners();
  }

  /// Disconnect and clean up
  void disconnect() {
    _wsService.disconnect();
    _users = [];
    _onlineUsers = [];
    _messages = [];
    _selectedUser = null;
    _typingUsers = {};
    _isConnected = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _wsService.dispose();
    super.dispose();
  }
}
```

---

## UI Widgets

### `lib/widgets/user_list.dart`

```dart
import 'package:flutter/material.dart';
import '../models/user.dart';

class UserList extends StatelessWidget {
  final List<User> users;
  final List<User> onlineUsers;
  final User? selectedUser;
  final Function(User) onSelectUser;

  const UserList({
    super.key,
    required this.users,
    required this.onlineUsers,
    required this.selectedUser,
    required this.onSelectUser,
  });

  @override
  Widget build(BuildContext context) {
    // Sort users: online first
    final sortedUsers = List<User>.from(users)
      ..sort((a, b) {
        final aOnline = onlineUsers.any((u) => u.id == a.id) ? 1 : 0;
        final bOnline = onlineUsers.any((u) => u.id == b.id) ? 1 : 0;
        return bOnline - aOnline;
      });

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.blue,
          child: Row(
            children: [
              const Icon(Icons.people, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                'Users (${onlineUsers.length} online)',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: sortedUsers.length,
            itemBuilder: (context, index) {
              final user = sortedUsers[index];
              final isOnline = onlineUsers.any((u) => u.id == user.id);
              final isSelected = selectedUser?.id == user.id;

              return ListTile(
                leading: Stack(
                  children: [
                    CircleAvatar(
                      child: Text(user.username[0].toUpperCase()),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isOnline ? Colors.green : Colors.grey,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
                  ],
                ),
                title: Text(user.username),
                subtitle: Text(isOnline ? 'Online' : 'Offline'),
                selected: isSelected,
                selectedTileColor: Colors.blue.withOpacity(0.1),
                onTap: () => onSelectUser(user),
              );
            },
          ),
        ),
      ],
    );
  }
}
```

### `lib/widgets/message_list.dart`

```dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/message.dart';

class MessageList extends StatefulWidget {
  final List<Message> messages;
  final String currentUserId;
  final String? typingUsername;

  const MessageList({
    super.key,
    required this.messages,
    required this.currentUserId,
    this.typingUsername,
  });

  @override
  State<MessageList> createState() => _MessageListState();
}

class _MessageListState extends State<MessageList> {
  final ScrollController _scrollController = ScrollController();

  @override
  void didUpdateWidget(MessageList oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Scroll to bottom when new message arrives
    if (widget.messages.length > oldWidget.messages.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(16),
            itemCount: widget.messages.length,
            itemBuilder: (context, index) {
              final message = widget.messages[index];
              final isMyMessage = message.isOutgoing ||
                  message.senderId == widget.currentUserId;

              return Align(
                alignment: isMyMessage
                    ? Alignment.centerRight
                    : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: isMyMessage
                        ? Colors.blue
                        : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.7,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        message.content,
                        style: TextStyle(
                          color: isMyMessage ? Colors.white : Colors.black,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        DateFormat.jm().format(message.createdAt),
                        style: TextStyle(
                          fontSize: 10,
                          color: isMyMessage
                              ? Colors.white70
                              : Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        if (widget.typingUsername != null)
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text(
              '${widget.typingUsername} is typing...',
              style: const TextStyle(
                fontStyle: FontStyle.italic,
                color: Colors.grey,
              ),
            ),
          ),
      ],
    );
  }
}
```

### `lib/widgets/message_input.dart`

```dart
import 'dart:async';
import 'package:flutter/material.dart';

class MessageInput extends StatefulWidget {
  final Function(String) onSend;
  final VoidCallback? onTypingStart;
  final VoidCallback? onTypingStop;
  final bool enabled;

  const MessageInput({
    super.key,
    required this.onSend,
    this.onTypingStart,
    this.onTypingStop,
    this.enabled = true,
  });

  @override
  State<MessageInput> createState() => _MessageInputState();
}

class _MessageInputState extends State<MessageInput> {
  final TextEditingController _controller = TextEditingController();
  Timer? _typingTimer;
  bool _isTyping = false;

  void _handleTextChange(String text) {
    if (text.isNotEmpty && !_isTyping) {
      _isTyping = true;
      widget.onTypingStart?.call();
    }

    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(seconds: 2), () {
      if (_isTyping) {
        _isTyping = false;
        widget.onTypingStop?.call();
      }
    });
  }

  void _handleSend() {
    final text = _controller.text.trim();
    if (text.isNotEmpty) {
      widget.onSend(text);
      _controller.clear();
      if (_isTyping) {
        _isTyping = false;
        widget.onTypingStop?.call();
      }
    }
  }

  @override
  void dispose() {
    _typingTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.2),
            blurRadius: 4,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                enabled: widget.enabled,
                onChanged: _handleTextChange,
                onSubmitted: (_) => _handleSend(),
                decoration: InputDecoration(
                  hintText: widget.enabled
                      ? 'Type a message...'
                      : 'Select a user to chat',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(25),
                    borderSide: BorderSide.none,
                  ),
                  filled: true,
                  fillColor: Colors.grey.shade100,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 10,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            CircleAvatar(
              backgroundColor: Colors.blue,
              child: IconButton(
                icon: const Icon(Icons.send, color: Colors.white),
                onPressed: widget.enabled ? _handleSend : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## Screens

### `lib/screens/chat_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import '../widgets/user_list.dart';
import '../widgets/message_list.dart';
import '../widgets/message_input.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  @override
  void initState() {
    super.initState();
    // Initialize chat provider
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = context.read<AuthProvider>();
      final chatProvider = context.read<ChatProvider>();
      if (authProvider.token != null) {
        chatProvider.init(authProvider.token!);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final chatProvider = context.watch<ChatProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text('Chat - ${authProvider.user?.username ?? ''}'),
        actions: [
          // Connection status indicator
          Container(
            margin: const EdgeInsets.only(right: 8),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: chatProvider.isConnected
                        ? Colors.green
                        : Colors.red,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  chatProvider.isConnected ? 'Connected' : 'Disconnected',
                  style: const TextStyle(fontSize: 12),
                ),
              ],
            ),
          ),
          // Logout button
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              chatProvider.disconnect();
              authProvider.logout();
            },
          ),
        ],
      ),
      body: Row(
        children: [
          // User list sidebar
          SizedBox(
            width: 250,
            child: UserList(
              users: chatProvider.users,
              onlineUsers: chatProvider.onlineUsers,
              selectedUser: chatProvider.selectedUser,
              onSelectUser: chatProvider.selectUser,
            ),
          ),
          // Chat area
          Expanded(
            child: Column(
              children: [
                // Chat header
                if (chatProvider.selectedUser != null)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: Colors.grey.shade200),
                      ),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          child: Text(
                            chatProvider.selectedUser!.username[0].toUpperCase(),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              chatProvider.selectedUser!.username,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            Text(
                              chatProvider.onlineUsers.any(
                                (u) => u.id == chatProvider.selectedUser!.id,
                              )
                                  ? 'Online'
                                  : 'Offline',
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                // Messages
                Expanded(
                  child: chatProvider.selectedUser != null
                      ? MessageList(
                          messages: chatProvider.messages,
                          currentUserId: authProvider.user?.id ?? '',
                          typingUsername: chatProvider.typingUsers[
                                      chatProvider.selectedUser?.id] ==
                                  true
                              ? chatProvider.selectedUser?.username
                              : null,
                        )
                      : const Center(
                          child: Text('Select a user to start chatting'),
                        ),
                ),
                // Message input
                MessageInput(
                  onSend: chatProvider.sendMessage,
                  onTypingStart: chatProvider.sendTypingStart,
                  onTypingStop: chatProvider.sendTypingStop,
                  enabled: chatProvider.selectedUser != null &&
                      chatProvider.isConnected,
                ),
              ],
            ),
          ),
        ],
      ),
      // Error snackbar
      bottomSheet: chatProvider.error != null
          ? Container(
              color: Colors.red,
              padding: const EdgeInsets.all(8),
              child: Text(
                chatProvider.error!,
                style: const TextStyle(color: Colors.white),
                textAlign: TextAlign.center,
              ),
            )
          : null,
    );
  }
}
```

### `lib/screens/login_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLogin = true;
  bool _isLoading = false;
  String? _error;
  
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final authProvider = context.read<AuthProvider>();
      
      if (_isLogin) {
        await authProvider.login(
          _emailController.text,
          _passwordController.text,
        );
      } else {
        await authProvider.register(
          _usernameController.text,
          _emailController.text,
          _passwordController.text,
        );
      }
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Card(
            elevation: 4,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _isLogin ? 'Login' : 'Register',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 24),
                    
                    if (_error != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: Colors.red.shade100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _error!,
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                    
                    if (!_isLogin)
                      TextFormField(
                        controller: _usernameController,
                        decoration: const InputDecoration(
                          labelText: 'Username',
                          prefixIcon: Icon(Icons.person),
                        ),
                        validator: (value) {
                          if (!_isLogin && (value == null || value.isEmpty)) {
                            return 'Please enter username';
                          }
                          return null;
                        },
                      ),
                    
                    if (!_isLogin) const SizedBox(height: 16),
                    
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        prefixIcon: Icon(Icons.email),
                      ),
                      keyboardType: TextInputType.emailAddress,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter email';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    
                    TextFormField(
                      controller: _passwordController,
                      decoration: const InputDecoration(
                        labelText: 'Password',
                        prefixIcon: Icon(Icons.lock),
                      ),
                      obscureText: true,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter password';
                        }
                        if (value.length < 6) {
                          return 'Password must be at least 6 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 24),
                    
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _submit,
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(_isLogin ? 'Login' : 'Register'),
                      ),
                    ),
                    const SizedBox(height: 16),
                    
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _isLogin = !_isLogin;
                          _error = null;
                        });
                      },
                      child: Text(
                        _isLogin
                            ? "Don't have an account? Register"
                            : 'Already have an account? Login',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
```

---

## Main App

### `lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/chat_provider.dart';
import 'screens/login_screen.dart';
import 'screens/chat_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..init()),
        ChangeNotifierProvider(create: (_) => ChatProvider()),
      ],
      child: MaterialApp(
        title: 'WebSocket Chat',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
          useMaterial3: true,
        ),
        home: Consumer<AuthProvider>(
          builder: (context, auth, _) {
            if (auth.isLoading) {
              return const Scaffold(
                body: Center(
                  child: CircularProgressIndicator(),
                ),
              );
            }
            return auth.isAuthenticated
                ? const ChatScreen()
                : const LoginScreen();
          },
        ),
      ),
    );
  }
}
```

---

## Best Practices

### 1. Handle App Lifecycle

```dart
class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final chatProvider = context.read<ChatProvider>();
    
    if (state == AppLifecycleState.resumed) {
      // Reconnect when app comes to foreground
      chatProvider.reconnect();
    } else if (state == AppLifecycleState.paused) {
      // Optionally disconnect when app goes to background
      // chatProvider.disconnect();
    }
  }
}
```

### 2. Network Connectivity

```dart
// Add connectivity_plus package
import 'package:connectivity_plus/connectivity_plus.dart';

// Monitor network changes
Connectivity().onConnectivityChanged.listen((result) {
  if (result != ConnectivityResult.none) {
    _wsService.reconnect();
  }
});
```

### 3. Local Message Storage

```dart
// Use sqflite or hive for local storage
import 'package:hive/hive.dart';

Future<void> cacheMessages(List<Message> messages) async {
  final box = await Hive.openBox('messages');
  await box.put('conversation_$userId', messages.map((m) => m.toJson()).toList());
}
```

---

## Troubleshooting

### Common Issues

1. **"Connection refused" on Android emulator**
   - Use `10.0.2.2` instead of `localhost`

2. **"Connection refused" on iOS simulator**
   - Use `localhost` or `127.0.0.1`

3. **"Connection refused" on physical device**
   - Use your computer's local IP address
   - Ensure phone is on same network
   - Check firewall settings

4. **WebSocket disconnects frequently**
   - Check network stability
   - Implement proper reconnection logic
   - Use heartbeat/ping mechanism

### Debugging

```dart
// Enable detailed logging
debugPrint('WebSocket: $message');

// Use Flutter DevTools
// Run: flutter run --debug
```

---

## Next Steps

1. Add push notifications with Firebase Cloud Messaging
2. Implement message encryption
3. Add file/image sharing
4. Implement message search
5. Add group chat support
6. Implement read receipts UI
7. Add message reactions
