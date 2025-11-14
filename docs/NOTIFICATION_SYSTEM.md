# Notification System Documentation

## Overview

The notification system provides multi-channel notifications (email and in-app) for auction events. It integrates with the bidding and auction lifecycle to keep users informed in real-time.

## Features

- **Multi-channel delivery**: Email and in-app notifications
- **Real-time updates**: Socket.IO integration for instant notifications
- **Template-based**: Pre-defined templates for common events
- **User preferences**: Customizable notification settings per user
- **Queue-based email**: Asynchronous email delivery with retry logic
- **TTL management**: Automatic cleanup of old notifications (90 days)

## Notification Types

1. **bid_outbid**: User has been outbid on an auction
2. **bid_won**: User won an auction
3. **auction_ended**: Auction has ended
4. **new_bid_received**: Seller received a new bid
5. **payment_received**: Seller received payment
6. **system**: General system notifications

## API Endpoints

### Get All Notifications
```
GET /api/v1/notifications
Query Parameters:
  - page: Page number (default: 1)
  - limit: Items per page (default: 20)
  - type: Filter by notification type (optional)
```

### Get Unread Notifications
```
GET /api/v1/notifications/unread
Query Parameters:
  - limit: Maximum notifications to return (default: 50)
```

### Get Unread Count
```
GET /api/v1/notifications/unread/count
```

### Mark Notification as Read
```
PUT /api/v1/notifications/:id/read
```

### Mark All as Read
```
PUT /api/v1/notifications/read-all
```

### Delete Notification
```
DELETE /api/v1/notifications/:id
```

### Update Preferences
```
PUT /api/v1/notifications/preferences
Body:
{
  "email": true/false,
  "inApp": true/false,
  "bidUpdates": true/false,
  "auctionUpdates": true/false,
  "paymentUpdates": true/false
}
```

## Real-time Events

The system emits Socket.IO events for real-time notifications:

### Event: `notification:new`
Emitted when a new notification is created for a user.

```javascript
{
  notification: {
    id: "notification_id",
    type: "bid_outbid",
    title: "You have been outbid!",
    message: "Your bid of $100 on 'Vintage Watch' has been outbid.",
    data: {
      auctionId: "auction_id",
      bidId: "bid_id",
      amount: 100
    },
    priority: "high",
    createdAt: "2025-11-14T10:00:00.000Z"
  },
  timestamp: "2025-11-14T10:00:00.000Z"
}
```

## Integration Points

### Bid Placement
When a bid is placed:
- Previous highest bidder receives "outbid" notification (within 30 seconds)
- Seller receives "new bid" notification (within 30 seconds)

### Auction End
When an auction closes:
- Winner receives "bid won" notification (within 1 minute)
- Seller receives "auction ended" notification (within 1 minute)
- All other bidders receive "auction ended" notification (within 1 minute)

### Payment
When payment is received:
- Seller receives "payment received" notification

## Email Queue

Email notifications are processed asynchronously using Bull queue:

- **Queue name**: `email-notifications`
- **Retry attempts**: 5
- **Backoff strategy**: Exponential (starting at 2 seconds)
- **Priority levels**: high (1), medium (5), low (10)

## User Preferences

Users can control notification delivery through preferences:

```javascript
{
  email: true,              // Receive email notifications
  inApp: true,              // Receive in-app notifications
  bidUpdates: true,         // Notifications for bid events
  auctionUpdates: true,     // Notifications for auction events
  paymentUpdates: true      // Notifications for payment events
}
```

## Service Architecture

### NotificationService
Core service for notification management:
- `createNotification()`: Create and queue notifications
- `createFromTemplate()`: Create from predefined templates
- `queueEmailNotification()`: Queue email for delivery
- `processEmailNotification()`: Process email queue jobs

### NotificationEventService
Handles event-driven notification triggers:
- `notifyUserOutbid()`: Outbid notification
- `notifySellerNewBid()`: New bid notification to seller
- `notifyAuctionWinner()`: Winner notification
- `notifySellerAuctionEnded()`: Auction ended notification to seller
- `notifyBiddersAuctionEnded()`: Auction ended notification to bidders
- `notifyPaymentReceived()`: Payment received notification

### Email Worker
Background worker that processes email queue:
- Listens to `email-notifications` queue
- Sends emails via nodemailer
- Marks notifications as sent
- Handles retries on failure

## Environment Variables

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@aiauction.com
FRONTEND_URL=http://localhost:3000
```

## Performance Requirements

- Outbid notifications: Within 30 seconds
- New bid notifications: Within 30 seconds
- Auction end notifications: Within 1 minute
- Real-time Socket.IO events: Within 1 second

## Database Indexes

Optimized queries with indexes on:
- `user` (single)
- `type` (single)
- `user + channels.inApp.read` (compound)
- `createdAt` (TTL index - 90 days)

## Error Handling

Notification failures are logged but don't break the main flow:
- Bid placement continues even if notification fails
- Auction closure continues even if notification fails
- Failed emails are retried up to 5 times
- All errors are logged for monitoring
