# Security Quick Reference

## Rate Limiting

### IP-Based
```
Limit: 100 requests/minute per IP
Applies to: All /api endpoints
```

### User-Based
```
Limit: 1000 requests/hour per user
Applies to: Authenticated routes
```

### Strict (Auth)
```
Limit: 20 requests/15 minutes
Applies to: /api/v1/auth/login, /api/v1/auth/register
```

## Input Validation

### Using Validation Middleware
```javascript
import { validate, authValidation } from '../middlewares/validation.middleware.js';

router.post('/login', validate(authValidation.login), login);
```

### Available Schemas
- `authValidation`: register, login, refreshToken
- `userValidation`: getUserById, updateUser, deleteUser
- `auctionValidation`: createAuction, updateAuction, searchAuctions
- `bidValidation`: placeBid, getBidsByAuction
- `notificationValidation`: getNotifications, markAsRead
- `analyticsValidation`: getStats, exportData

## Sanitization

### Automatic (Global)
- NoSQL injection prevention
- XSS prevention
- Custom sanitization (whitespace, null bytes, control chars)

### Manual (File Uploads)
```javascript
import { sanitizeFileUpload } from '../middlewares/sanitization.middleware.js';

router.post('/upload', uploadMultiple, sanitizeFileUpload, handleUpload);
```

## Security Headers

### Helmet.js (Automatic)
- Content Security Policy
- HSTS
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer Policy

### CORS
```env
FRONTEND_URL=https://yourdomain.com,https://www.yourdomain.com
```

## Audit Logging

### Using Audit Middleware
```javascript
import { 
    auditAuthAttempt,
    auditResourceAccess,
    checkAccountLockout 
} from '../middlewares/audit.middleware.js';

// Auth routes
router.post('/login', checkAccountLockout, auditAuthAttempt, login);

// Resource routes
router.post('/bids', authenticate, auditResourceAccess('BID_PLACE', 'bid'), placeBid);
```

### Manual Logging
```javascript
import auditService from '../services/audit.service.js';

await auditService.logAuthAttempt({
    email: 'user@example.com',
    success: true,
    userId: user._id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
});
```

## Security Checks

### Account Lockout
```
Trigger: 5 failed login attempts in 15 minutes
Action: Block login for 15 minutes
```

### IP Blocking
```
Trigger: 3 suspicious activities in 1 hour
Action: Block IP temporarily
```

### Bid Pattern Detection
```
Trigger: 5+ bids in 1 minute
Action: Log suspicious activity
```

## Admin Endpoints

### View Audit Logs
```
GET /api/v1/audit/logs
  ?action=AUTH_LOGIN_FAILED
  &status=failure
  &startDate=2024-01-01
  &page=1&limit=50
```

### User Security Summary
```
GET /api/v1/audit/users/:userId/security?days=30
```

### Failed Login Stats
```
GET /api/v1/audit/failed-logins
  ?email=user@example.com
  &ipAddress=192.168.1.1
```

### Suspicious Activity
```
GET /api/v1/audit/suspicious-activity?ipAddress=192.168.1.1
```

## Environment Variables

```env
# JWT Secrets
JWT_ACCESS_SECRET=your_strong_secret_here
JWT_REFRESH_SECRET=your_strong_secret_here

# CORS
FRONTEND_URL=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
USER_RATE_LIMIT_MAX_REQUESTS=1000

# Redis (for distributed rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

## Common Issues

### Rate Limit Exceeded
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  }
}
```
**Solution**: Wait for rate limit window to reset

### Validation Failed
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [
      {
        "field": "body.email",
        "message": "email must be a valid email"
      }
    ]
  }
}
```
**Solution**: Fix the invalid field(s)

### Account Locked
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Too many failed login attempts. Please try again in 15 minutes."
  }
}
```
**Solution**: Wait 15 minutes or contact support

### IP Blocked
```json
{
  "success": false,
  "error": {
    "code": "IP_BLOCKED",
    "message": "Your IP has been temporarily blocked due to suspicious activity."
  }
}
```
**Solution**: Contact support or wait for automatic unblock

## Testing Commands

### Test Rate Limiting
```bash
# Send 110 requests
for i in {1..110}; do curl http://localhost:5000/api/v1/auctions; done
```

### Test Validation
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid", "password": "123"}'
```

### Test Audit Logs
```bash
# Login with wrong password
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "wrong"}'

# Check logs (as admin)
curl http://localhost:5000/api/v1/audit/logs?action=AUTH_LOGIN_FAILED \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Monitoring Checklist

- [ ] Failed login attempts < 10/hour
- [ ] Rate limit hits < 100/hour
- [ ] Suspicious activities < 5/day
- [ ] Unauthorized access attempts < 20/hour
- [ ] Audit log storage < 80% capacity
- [ ] Redis connection healthy
- [ ] All security headers present in responses

## Emergency Response

### If Attack Detected
1. Check audit logs: `GET /api/v1/audit/logs`
2. Identify attacker IP
3. Block IP at firewall level
4. Review recent security events
5. Update security rules if needed
6. Document incident

### If Account Compromised
1. Check user security summary
2. Review recent login locations
3. Force password reset
4. Invalidate all tokens
5. Notify user
6. Document incident

## Resources

- Full Documentation: `docs/SECURITY.md`
- Implementation Summary: `docs/SECURITY_IMPLEMENTATION_SUMMARY.md`
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Express Security: https://expressjs.com/en/advanced/best-practice-security.html
