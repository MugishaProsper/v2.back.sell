# Authentication API Documentation

## Overview

The Authentication API provides endpoints for user registration, login, token management, and user profile access.

## Base URL

```
/api/v1/auth
```

## Endpoints

### 1. Register User

**POST** `/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "buyer"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "profile": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "role": "buyer",
      "verified": false,
      "notificationPreferences": {
        "email": true,
        "inApp": true,
        "bidUpdates": true,
        "auctionUpdates": true,
        "marketing": false
      },
      "stats": {
        "auctionsCreated": 0,
        "auctionsWon": 0,
        "totalBids": 0,
        "totalSpent": 0
      },
      "createdAt": "2025-11-14T10:00:00.000Z",
      "updatedAt": "2025-11-14T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User registered successfully"
}
```

**Notes:**
- Refresh token is set as httpOnly cookie
- Password must be at least 8 characters
- Email must be unique and valid format
- Role can be: `buyer`, `seller`, or `admin` (defaults to `buyer`)

---

### 2. Login

**POST** `/login`

Authenticate user and receive access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "profile": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "role": "buyer",
      "lastLogin": "2025-11-14T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

**Notes:**
- Refresh token is set as httpOnly cookie
- Access token expires in 15 minutes
- Refresh token expires in 7 days

---

### 3. Refresh Token

**POST** `/refresh-token`

Get a new access token using refresh token.

**Request Body (optional if cookie is set):**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Token refreshed successfully"
}
```

**Notes:**
- Refresh token can be provided in request body or httpOnly cookie
- Cookie takes precedence if both are provided

---

### 4. Get Current User

**GET** `/me`

Get authenticated user's profile information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "profile": {
        "firstName": "John",
        "lastName": "Doe"
      },
      "role": "buyer",
      "verified": false,
      "notificationPreferences": {
        "email": true,
        "inApp": true,
        "bidUpdates": true,
        "auctionUpdates": true,
        "marketing": false
      },
      "stats": {
        "auctionsCreated": 0,
        "auctionsWon": 0,
        "totalBids": 0,
        "totalSpent": 0
      },
      "lastLogin": "2025-11-14T10:00:00.000Z",
      "createdAt": "2025-11-14T10:00:00.000Z",
      "updatedAt": "2025-11-14T10:00:00.000Z"
    }
  }
}
```

**Notes:**
- Requires valid access token in Authorization header
- Returns full user profile

---

### 5. Logout

**POST** `/logout`

Logout user and clear refresh token.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Notes:**
- Clears refresh token cookie
- Client should discard access token

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": ["Additional error details"],
    "timestamp": "2025-11-14T10:00:00.000Z",
    "path": "/api/v1/auth/register"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_FAILED` | 400 | Input validation failed |
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered |
| `INVALID_EMAIL_FORMAT` | 400 | Email format is invalid |
| `PASSWORD_TOO_SHORT` | 400 | Password is less than 8 characters |
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password |
| `AUTH_TOKEN_MISSING` | 401 | Authorization token not provided |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token has expired |
| `AUTH_INVALID_TOKEN` | 401 | Invalid access token |
| `REFRESH_TOKEN_MISSING` | 401 | Refresh token not provided |
| `INVALID_REFRESH_TOKEN` | 401 | Invalid refresh token |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token has expired |
| `USER_NOT_FOUND` | 404 | User not found |
| `INTERNAL_SERVER_ERROR` | 500 | Server error occurred |

---

## Authentication Flow

### Registration Flow
1. User submits registration data
2. Server validates input
3. Server checks if email exists
4. Server hashes password (bcrypt, 12 rounds)
5. Server creates user in database
6. Server generates access token (15min) and refresh token (7 days)
7. Server returns access token in response body
8. Server sets refresh token as httpOnly cookie

### Login Flow
1. User submits credentials
2. Server validates input
3. Server finds user by email
4. Server compares password hash
5. Server updates last login timestamp
6. Server generates new tokens
7. Server returns access token in response body
8. Server sets refresh token as httpOnly cookie

### Token Refresh Flow
1. Client detects access token expiration
2. Client sends refresh token (cookie or body)
3. Server verifies refresh token
4. Server generates new access token
5. Server returns new access token

### Protected Route Access
1. Client includes access token in Authorization header
2. Server verifies token signature and expiration
3. Server loads user from database
4. Server attaches user to request object
5. Request proceeds to route handler

---

## Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Tokens**: Signed with secret keys
- **httpOnly Cookies**: Refresh tokens stored securely
- **Token Expiration**: Access tokens expire in 15 minutes
- **Input Validation**: All inputs validated and sanitized
- **Security Logging**: All auth attempts logged
- **Rate Limiting**: 100 requests per minute per IP

---

## Usage Examples

### cURL Examples

**Register:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

**Get Current User:**
```bash
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Refresh Token:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/refresh-token \
  -b cookies.txt
```

**Logout:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -b cookies.txt
```

### JavaScript/Fetch Examples

**Register:**
```javascript
const response = await fetch('http://localhost:5000/api/v1/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123',
    firstName: 'John',
    lastName: 'Doe'
  }),
  credentials: 'include' // Include cookies
});

const data = await response.json();
const accessToken = data.data.accessToken;
```

**Login:**
```javascript
const response = await fetch('http://localhost:5000/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123'
  }),
  credentials: 'include'
});

const data = await response.json();
localStorage.setItem('accessToken', data.data.accessToken);
```

**Protected Request:**
```javascript
const accessToken = localStorage.getItem('accessToken');

const response = await fetch('http://localhost:5000/api/v1/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  credentials: 'include'
});

const data = await response.json();
```
