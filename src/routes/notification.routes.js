import express from 'express';
import {
    getNotifications,
    getUnreadNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences
} from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

// Get all notifications for authenticated user
router.get('/', getNotifications);

// Get unread notifications
router.get('/unread', getUnreadNotifications);

// Get unread notification count
router.get('/unread/count', getUnreadCount);

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

// Update notification preferences
router.put('/preferences', updatePreferences);

// Mark specific notification as read
router.put('/:id/read', markAsRead);

// Delete notification
router.delete('/:id', deleteNotification);

export default router;
