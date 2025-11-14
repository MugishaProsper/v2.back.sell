import notificationService from '../services/notification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Get all notifications for the authenticated user
 * @route GET /api/v1/notifications
 * @access Private
 */
export const getNotifications = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 20, type } = req.query;

    const options = {
        page: parseInt(page),
        limit: parseInt(limit)
    };

    if (type) {
        options.type = type;
    }

    const result = await notificationService.getUserNotifications(userId, options);

    res.status(200).json(
        new ApiResponse(200, result, 'Notifications retrieved successfully')
    );
});

/**
 * Get unread notifications for the authenticated user
 * @route GET /api/v1/notifications/unread
 * @access Private
 */
export const getUnreadNotifications = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { limit = 50 } = req.query;

    const notifications = await notificationService.getUnreadNotifications(userId, {
        limit: parseInt(limit)
    });

    res.status(200).json(
        new ApiResponse(200, { notifications }, 'Unread notifications retrieved successfully')
    );
});

/**
 * Get unread notification count
 * @route GET /api/v1/notifications/unread/count
 * @access Private
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const count = await notificationService.getUnreadCount(userId);

    res.status(200).json(
        new ApiResponse(200, { count }, 'Unread count retrieved successfully')
    );
});

/**
 * Mark notification as read
 * @route PUT /api/v1/notifications/:id/read
 * @access Private
 */
export const markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await notificationService.markAsRead(id, userId);

    if (!notification) {
        throw new ApiError(404, 'Notification not found');
    }

    res.status(200).json(
        new ApiResponse(200, { notification }, 'Notification marked as read')
    );
});

/**
 * Mark all notifications as read
 * @route PUT /api/v1/notifications/read-all
 * @access Private
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const result = await notificationService.markAllAsRead(userId);

    res.status(200).json(
        new ApiResponse(200, { modifiedCount: result.modifiedCount }, 'All notifications marked as read')
    );
});

/**
 * Delete notification
 * @route DELETE /api/v1/notifications/:id
 * @access Private
 */
export const deleteNotification = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await notificationService.deleteNotification(id, userId);

    if (!notification) {
        throw new ApiError(404, 'Notification not found');
    }

    res.status(200).json(
        new ApiResponse(200, null, 'Notification deleted successfully')
    );
});

/**
 * Update notification preferences
 * @route PUT /api/v1/notifications/preferences
 * @access Private
 */
export const updatePreferences = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { email, inApp, bidUpdates, auctionUpdates, paymentUpdates } = req.body;

    const preferences = {};
    
    if (typeof email !== 'undefined') preferences.email = email;
    if (typeof inApp !== 'undefined') preferences.inApp = inApp;
    if (typeof bidUpdates !== 'undefined') preferences.bidUpdates = bidUpdates;
    if (typeof auctionUpdates !== 'undefined') preferences.auctionUpdates = auctionUpdates;
    if (typeof paymentUpdates !== 'undefined') preferences.paymentUpdates = paymentUpdates;

    const user = await notificationService.updatePreferences(userId, preferences);

    res.status(200).json(
        new ApiResponse(200, { preferences: user.notificationPreferences }, 'Preferences updated successfully')
    );
});
