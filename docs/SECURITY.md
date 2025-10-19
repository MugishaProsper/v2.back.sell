# Security Implementation Guide

This document describes the comprehensive security features implemented in the AI Auction Backend system.

## Overview

The security implementation follows industry best practices and addresses the requirements specified in the design document. It includes multiple layers of protection:

1. **Rate Limiting** - Prevents abuse and DDoS attacks
2. **Input Validation & Sanitization** - Prevents injection attacks
3. **Security Middleware** - HTTP security headers and CORS
4. **Audit Logging** - Tracks security events and suspicious activities

## 1. Rate Limiting

### IP-Based Rate Limiting
- **Limit**: 100 requests per minute per IP address
- **Scope**: All `/api` endpoints
- **Storage**: Redis (with fallback to memory)
- **Headers**: Returns `RateLimit-*` headers in responses

### User-Based Rate Limiting
- **Limit**: 1000 requests per hour per authenticated user
- **Scope**: All authenticated endpoints
- **Key**: User ID (falls back to IP for unauthenticated requests)
- **Storage**: Redis (with fallback to memory)

### Strict Rate Limiting (Auth Endpoints)
- **Limit**: 20 requests per 15 minutes
- **Scope**: `/api/v1/auth/login` and `/api/v1/auth/register`
- **Purpose**: Prevent brute force attacks

### Configuration

Environment variables in `.env`:
```env
RATE_LIMIT_WINDOW_MS=60000              # 1 minute
RATE_LIMIT_MAX_REQUESTS=100             # 100 requests per window
USER_RATE_LIMIT_MAX_REQUESTS=1000       # 1000 requests per hour
```

### Usage

Rate limiting is automatically applied:
- IP-based: All `/api` routes
- User-based: Routes with `userRateLimiter` middleware
- Strict: Auth routes with `strictRateLimiter` middleware

## 2. Input Validation & Sanitization

### Validation with Joi

All request data is validated using Joi schemas before processing:

```javascript
import { validate, authValidation } from '../middlewares/validation.middleware.js';

router.post('/login', validate(authValidation.login), login);
```

### Available Validation Schemas

- **authValidation**: register, login, refreshToken
- **userValidation**: getUserById, updateUser, deleteUser
- **auctionValidation**: createAuction, updateAuction, searchAuctions, etc.
- **bidValidation**: placeBid, getBidsByAuction, getBidsByUser
- **notificationValidation**: getNotifications, markAsRead, updatePreferences
- **analyticsValidation**: getStats, exportData

### Sanitization Layers

1. **NoSQL Injection Prevention** (`sanitizeNoSQL`)
   - Removes keys starting with `$` or containing `.`
   - Logs suspicious attempts

2. **XSS Prevention** (`sanitizeXSS`)
   - Cleans malicious HTML/JavaScript from inputs

3. **Custom Sanitization** (`customSanitize`)
   - Trims whitespace
   - Removes null bytes and control characters
   - Recursively sanitizes nested objects

4. **File Upload Sanitization** (`sanitizeFileUpload`)
   - Sanitizes filenames
   - Prevents directory traversal attacks

### Usage

Sanitization is automatically applied globally in `server.js`:
```javascript
app.use(sanitizeNoSQL);
app.use(sanitizeXSS);
app.use(customSanitize);
```

## 3. Security Middleware

### Helmet.js Configuration

Comprehensive HTTP security headers:
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options (Clickjacking protection)
- X-Content-Type-Options (MIME sniffing prevention)
- X-XSS-Protection
- Referrer Policy
- And more...

### CORS Configuration

- **Allowed Origins**: Configured via `FRONTEND_URL` environment variable
- **Credentials**: Enabled for cookie-based authentication
- **Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Exposed Headers**: Includes rate limit and custom headers

### Additional Security Features

1. **HTTPS Enforcement** (Production)
   - Redirects HTTP to HTTPS in production

2. **Request Timeout**
   - 30-second timeout prevents resource exhaustion

3. **Content-Type Validation**
   - Requires `application/json` for POST/PUT/PATCH requests

4. **Suspicious Activity Detection**
   - Blocks requests with SQL injection patterns
   - Blocks XSS attempts
   - Blocks path traversal attempts
   - Blocks command injection attempts

## 4. Audit Logging & Security Monitoring

### Audit Log Model

All security-relevant events are logged to MongoDB with:
- User information
- Action type
- Resource details
- IP address and user agent
- Status (success/failure/warning)
- Timestamp
- Additional metadata

### Logged Events

#### Authentication Events
- `AUTH_LOGIN_SUCCESS` / `AUTH_LOGIN_FAILED`
- `AUTH_LOGOUT`
- `AUTH_REGISTER`
- `AUTH_TOKEN_REFRESH`
- `AUTH_PASSWORD_RESET`

#### Security Events
- `SECURITY_SUSPICIOUS_ACTIVITY`
- `SECURITY_RATE_LIMIT_EXCEEDED`
- `SECURITY_UNAUTHORIZED_ACCESS`
- `SECURITY_CSRF_VIOLATION`
- `SECURITY_XSS_ATTEMPT`
- `SECURITY_SQL_INJECTION_ATTEMPT`

#### Resource Events
- `AUCTION_CREATE` / `AUCTION_UPDATE` / `AUCTION_DELETE`
- `BID_PLACE` / `BID_RETRACT`
- `PAYMENT_INITIATE` / `PAYMENT_COMPLETE` / `PAYMENT_FAILED`
- `USER_UPDATE` / `USER_DELETE`

### Audit Service API

```javascript
import auditService from '../services/audit.service.js';

// Log authentication attempt
await auditService.logAuthAttempt({
    email: 'user@example.com',
    success: true,
    userId: '...',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
});

// Log suspicious activity
await auditService.logSuspiciousActivity({
    userId: '...',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    path: req.path,
    method: req.method,
    details: { reason: 'Multiple failed logins' },
});

// Get failed login attempts
const failedAttempts = await auditService.getFailedLoginAttempts(
    'user@example.com',
    '192.168.1.1',
    15 * 60 * 1000 // 15 minutes
);
```

### Audit Middleware

Automatically logs events when applied to routes:

```javascript
import { 
    auditAuthAttempt, 
    auditBidPattern,
    checkAccountLockout,
    checkSuspiciousIP 
} from '../middlewares/audit.middleware.js';

// Check for account lockout before login
router.post('/login', checkAccountLockout, auditAuthAttempt, login);

// Check for unusual bid patterns
router.post('/bids', authenticate, auditBidPattern, placeBid);
```

### Security Features

1. **Account Lockout**
   - Locks account after 5 failed login attempts in 15 minutes
   - Prevents brute force attacks

2. **IP Blocking**
   - Blocks IP after 3 suspicious activities in 1 hour
   - Automatic temporary ban

3. **Bid Pattern Detection**
   - Detects rapid bidding (>5 bids per minute)
   - Flags potential bot activity

4. **Unauthorized Access Tracking**
   - Logs all authorization failures
   - Helps identify attack patterns

### Admin Audit Endpoints

Admins can query audit logs:

```
GET /api/v1/audit/logs
  ?userId=...
  &action=AUTH_LOGIN_FAILED
  &status=failure
  &startDate=2024-01-01
  &endDate=2024-01-31
  &page=1
  &limit=50

GET /api/v1/audit/users/:userId/security
  ?days=30

GET /api/v1/audit/failed-logins
  ?email=user@example.com
  &ipAddress=192.168.1.1

GET /api/v1/audit/suspicious-activity
  ?ipAddress=192.168.1.1
```

### Data Retention

- Audit logs are automatically deleted after 90 days (TTL index)
- Can be adjusted in the model if needed

## Security Best Practices

### For Developers

1. **Always validate input** - Use Joi schemas for all endpoints
2. **Use audit middleware** - Log sensitive operations
3. **Check authorization** - Use `authenticate` and `authorize` middleware
4. **Sanitize output** - Don't expose sensitive data in responses
5. **Use HTTPS** - Always in production
6. **Keep dependencies updated** - Run `npm audit` regularly

### For Deployment

1. **Set strong JWT secrets** - Use long, random strings
2. **Configure CORS properly** - Only allow trusted origins
3. **Enable HTTPS** - Use TLS 1.3
4. **Monitor audit logs** - Set up alerts for suspicious activity
5. **Use Redis for rate limiting** - Better performance and scaling
6. **Regular security audits** - Review logs and patterns

### Environment Variables

Required security-related environment variables:

```env
# JWT Secrets (use strong, random values)
JWT_ACCESS_SECRET=your_strong_secret_here
JWT_REFRESH_SECRET=your_strong_secret_here

# Frontend URLs (comma-separated for multiple)
FRONTEND_URL=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
USER_RATE_LIMIT_MAX_REQUESTS=1000

# Redis (for distributed rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Failed Login Attempts** - Spike indicates brute force attack
2. **Rate Limit Hits** - High rate may indicate DDoS
3. **Suspicious Activity Count** - Multiple events from same IP
4. **Unauthorized Access Attempts** - Potential privilege escalation
5. **Unusual Bid Patterns** - Bot activity or manipulation

### Recommended Alerts

- Failed logins > 10 in 5 minutes from same IP
- Suspicious activity > 5 in 1 hour from same IP
- Rate limit exceeded > 100 times in 1 hour
- Unauthorized access attempts > 20 in 1 hour

## Testing Security Features

### Test Rate Limiting

```bash
# Test IP rate limiting
for i in {1..110}; do curl http://localhost:5000/api/v1/auctions; done

# Should return 429 after 100 requests
```

### Test Input Validation

```bash
# Test invalid email
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email", "password": "test123"}'

# Should return 400 with validation error
```

### Test Audit Logging

```bash
# Login with wrong password
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "wrong"}'

# Check audit logs (as admin)
curl http://localhost:5000/api/v1/audit/logs?action=AUTH_LOGIN_FAILED \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Troubleshooting

### Rate Limit Issues

**Problem**: Legitimate users getting rate limited

**Solution**: 
- Increase limits in environment variables
- Use Redis for better distributed rate limiting
- Whitelist specific IPs if needed

### Validation Errors

**Problem**: Valid requests being rejected

**Solution**:
- Check Joi schema definitions
- Review validation error details in response
- Update schemas if requirements changed

### Audit Log Performance

**Problem**: Slow queries on audit logs

**Solution**:
- Indexes are already created on common fields
- Consider archiving old logs
- Use pagination for large result sets

## Security Incident Response

If a security incident is detected:

1. **Identify** - Check audit logs for the incident
2. **Contain** - Block malicious IPs if needed
3. **Investigate** - Review full audit trail
4. **Remediate** - Fix vulnerabilities
5. **Document** - Record incident details
6. **Review** - Update security measures

## Compliance

This implementation helps meet common compliance requirements:

- **GDPR**: Audit logs track data access, TTL for data retention
- **PCI DSS**: Input validation, encryption, audit logging
- **SOC 2**: Security monitoring, access controls, audit trails
- **HIPAA**: Access logging, authentication, authorization

## Future Enhancements

Potential security improvements:

1. **Two-Factor Authentication (2FA)**
2. **IP Geolocation Blocking**
3. **Advanced Bot Detection**
4. **Real-time Security Dashboards**
5. **Automated Threat Response**
6. **Security Information and Event Management (SIEM) Integration**
7. **Penetration Testing Automation**

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Joi Validation](https://joi.dev/api/)
- [Rate Limiting Strategies](https://www.cloudflare.com/learning/bots/what-is-rate-limiting/)
