# REST API Documentation

Complete documentation for all REST API endpoints in the WebSocket Chat Application.

## Table of Contents

1. [Base URL](#base-url)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Handling](#error-handling)
5. [Endpoints](#endpoints)
   - [Auth Endpoints](#auth-endpoints)
   - [User Endpoints](#user-endpoints)
   - [Message Endpoints](#message-endpoints)
6. [Testing with Postman](#testing-with-postman)

---

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require authentication using JWT (JSON Web Token).

### How to Authenticate

1. Register or login to get a JWT token
2. Include the token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Token Expiration

Tokens expire after 7 days by default (configurable via `JWT_EXPIRES_IN` environment variable).

---

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data here
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing token |
| 404 | Not Found |
| 500 | Internal Server Error |

### Common Errors

| Error | Description |
|-------|-------------|
| "Not authorized to access this route" | Missing or invalid token |
| "User not found. Token is invalid." | User was deleted or token is corrupted |
| "Validation error" | Request body validation failed |

---

## Endpoints

### Auth Endpoints

#### Register a New User

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Authentication:** Not required

**Request Body:**

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Validation Rules:**
- `username`: Required, 3-30 characters, unique
- `email`: Required, valid email format, unique
- `password`: Required, minimum 6 characters

**Success Response (201):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "isOnline": false,
      "lastSeen": "2024-01-01T00:00:00.000Z",
      "avatar": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "message": "Email already registered"
}
```

---

#### Login

Authenticate an existing user.

**Endpoint:** `POST /api/auth/login`

**Authentication:** Not required

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "isOnline": false,
      "lastSeen": "2024-01-01T00:00:00.000Z",
      "avatar": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (401):**

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

#### Get Current User

Get the authenticated user's profile.

**Endpoint:** `GET /api/auth/me`

**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "isOnline": true,
      "lastSeen": "2024-01-01T00:00:00.000Z",
      "avatar": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

#### Update Profile

Update the authenticated user's profile.

**Endpoint:** `PUT /api/auth/profile`

**Authentication:** Required

**Request Body:**

```json
{
  "username": "newusername",
  "avatar": "https://example.com/avatar.jpg"
}
```

Note: All fields are optional. Only provided fields will be updated.

**Success Response (200):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "newusername",
      "email": "john@example.com",
      "isOnline": true,
      "lastSeen": "2024-01-01T00:00:00.000Z",
      "avatar": "https://example.com/avatar.jpg",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

#### Change Password

Change the authenticated user's password.

**Endpoint:** `PUT /api/auth/password`

**Authentication:** Required

**Request Body:**

```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Note: A new token is returned. Update your stored token.

---

### User Endpoints

#### Get All Users

Get a paginated list of all users (excluding current user).

**Endpoint:** `GET /api/users`

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Users per page |

**Example:** `GET /api/users?page=1&limit=10`

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "username": "janedoe",
        "email": "jane@example.com",
        "avatar": null,
        "isOnline": true,
        "lastSeen": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

#### Get Online Users

Get list of currently online users (excluding current user).

**Endpoint:** `GET /api/users/online`

**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "username": "janedoe",
        "email": "jane@example.com",
        "avatar": null,
        "isOnline": true
      }
    ],
    "totalOnline": 2
  }
}
```

Note: `totalOnline` includes the current user.

---

#### Search Users

Search for users by username or email.

**Endpoint:** `GET /api/users/search`

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Search term |

**Example:** `GET /api/users/search?query=john`

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "username": "johndoe",
        "email": "john@example.com",
        "avatar": null,
        "isOnline": true,
        "lastSeen": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

#### Get User by ID

Get a specific user's profile.

**Endpoint:** `GET /api/users/:id`

**Authentication:** Required

**URL Parameters:**

| Parameter | Description |
|-----------|-------------|
| id | User's MongoDB ObjectId |

**Example:** `GET /api/users/507f1f77bcf86cd799439011`

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "avatar": null,
      "isOnline": true,
      "lastSeen": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "message": "User not found"
}
```

---

### Message Endpoints

#### Get Conversations List

Get list of all conversations with last message and unread count.

**Endpoint:** `GET /api/messages/conversations`

**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "user": {
          "_id": "507f1f77bcf86cd799439012",
          "username": "janedoe",
          "email": "jane@example.com",
          "avatar": null,
          "isOnline": true,
          "lastSeen": "2024-01-01T00:00:00.000Z"
        },
        "lastMessage": {
          "content": "Hey, how are you?",
          "createdAt": "2024-01-01T12:00:00.000Z",
          "isFromMe": false
        },
        "unreadCount": 2
      }
    ]
  }
}
```

---

#### Get Unread Message Count

Get total count of unread messages.

**Endpoint:** `GET /api/messages/unread/count`

**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

---

#### Get Conversation with User

Get message history with a specific user.

**Endpoint:** `GET /api/messages/:userId`

**Authentication:** Required

**URL Parameters:**

| Parameter | Description |
|-----------|-------------|
| userId | Other user's MongoDB ObjectId |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Messages per page |

**Example:** `GET /api/messages/507f1f77bcf86cd799439012?page=1&limit=20`

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "507f1f77bcf86cd799439013",
        "sender": {
          "_id": "507f1f77bcf86cd799439011",
          "username": "johndoe",
          "avatar": null
        },
        "receiver": {
          "_id": "507f1f77bcf86cd799439012",
          "username": "janedoe",
          "avatar": null
        },
        "content": "Hello!",
        "messageType": "text",
        "isRead": true,
        "readAt": "2024-01-01T12:01:00.000Z",
        "status": "read",
        "createdAt": "2024-01-01T12:00:00.000Z",
        "updatedAt": "2024-01-01T12:01:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

#### Send Message (REST Alternative)

Send a message via REST API (alternative to WebSocket).

**Endpoint:** `POST /api/messages`

**Authentication:** Required

**Request Body:**

```json
{
  "receiverId": "507f1f77bcf86cd799439012",
  "content": "Hello! How are you?",
  "messageType": "text"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| receiverId | string | Yes | Recipient's user ID |
| content | string | Yes | Message content (max 5000 chars) |
| messageType | string | No | "text", "image", or "file" (default: "text") |

**Success Response (201):**

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": {
      "_id": "507f1f77bcf86cd799439013",
      "sender": {
        "_id": "507f1f77bcf86cd799439011",
        "username": "johndoe",
        "avatar": null
      },
      "receiver": {
        "_id": "507f1f77bcf86cd799439012",
        "username": "janedoe",
        "avatar": null
      },
      "content": "Hello! How are you?",
      "messageType": "text",
      "isRead": false,
      "readAt": null,
      "status": "sent",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

Note: This endpoint does NOT send real-time notifications. Use WebSocket for instant delivery.

---

#### Mark Messages as Read

Mark all messages from a specific user as read.

**Endpoint:** `PUT /api/messages/read/:userId`

**Authentication:** Required

**URL Parameters:**

| Parameter | Description |
|-----------|-------------|
| userId | Sender's user ID |

**Example:** `PUT /api/messages/read/507f1f77bcf86cd799439012`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Messages marked as read",
  "data": {
    "modifiedCount": 3
  }
}
```

---

## Testing with Postman

### Setup

1. Import the Postman collection from `postman/REST_API_Collection.json`
2. Create an environment with these variables:
   - `baseUrl`: `http://localhost:3000`
   - `token`: (leave empty, will be auto-populated)

### Testing Flow

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Register a user:**
   - Send POST request to `/api/auth/register`
   - Copy the token from the response

3. **Set the token:**
   - Set the `token` environment variable with the received JWT

4. **Test authenticated endpoints:**
   - All requests will automatically use the token

### Postman Collection Features

The included Postman collection has:

- **Pre-request Scripts:** Auto-populate authorization headers
- **Tests:** Validate response structure and status codes
- **Environment Variables:** Easy switching between environments
- **Examples:** Sample request bodies for all endpoints

### Quick Test Commands

Using curl:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get users (with token)
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Rate Limiting

Currently, no rate limiting is implemented. For production, consider adding:

- Express rate limiter middleware
- Per-IP request limits
- Per-user API quotas

---

## CORS Configuration

The API allows cross-origin requests. Configure allowed origins via the `CORS_ORIGIN` environment variable.

---

## Versioning

This is version 1.0.0 of the API. Future versions will maintain backward compatibility where possible.
