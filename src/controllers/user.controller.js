import userService from '../services/user.service.js';
import logger from '../config/logger.js';
import { sanitizeInput } from '../utils/validation.js';

/**
 * Get user by ID
 * GET /api/v1/users/:id
 */
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await userService.getUserById(id);
        
        res.status(200).json({
            success: true,
            data: {
                user
            }
        });
    } catch (error) {
        logger.error('Get user by ID controller error:', error);
        
        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while fetching user data',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Update user profile
 * PUT /api/v1/users/:id
 */
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Authorization check: users can only modify their own data
        if (req.user.id !== id && req.user.role !== 'admin') {
            logger.warn(`Unauthorized update attempt: User ${req.user.id} tried to update user ${id}`);
            return res.status(403).json({
                success: false,
                error: {
                    code: 'AUTH_INSUFFICIENT_PERMISSIONS',
                    message: 'You can only update your own profile',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        // Sanitize input data
        const updateData = {};
        
        if (req.body.profile) {
            updateData.profile = {};
            
            if (req.body.profile.firstName) {
                updateData.profile.firstName = sanitizeInput(req.body.profile.firstName);
            }
            if (req.body.profile.lastName) {
                updateData.profile.lastName = sanitizeInput(req.body.profile.lastName);
            }
            if (req.body.profile.phone) {
                updateData.profile.phone = sanitizeInput(req.body.profile.phone);
            }
            if (req.body.profile.avatar) {
                updateData.profile.avatar = sanitizeInput(req.body.profile.avatar);
            }
            if (req.body.profile.address) {
                updateData.profile.address = {};
                if (req.body.profile.address.street) {
                    updateData.profile.address.street = sanitizeInput(req.body.profile.address.street);
                }
                if (req.body.profile.address.city) {
                    updateData.profile.address.city = sanitizeInput(req.body.profile.address.city);
                }
                if (req.body.profile.address.state) {
                    updateData.profile.address.state = sanitizeInput(req.body.profile.address.state);
                }
                if (req.body.profile.address.zipCode) {
                    updateData.profile.address.zipCode = sanitizeInput(req.body.profile.address.zipCode);
                }
                if (req.body.profile.address.country) {
                    updateData.profile.address.country = sanitizeInput(req.body.profile.address.country);
                }
            }
        }
        
        const updatedUser = await userService.updateProfile(id, updateData);
        
        res.status(200).json({
            success: true,
            data: {
                user: updatedUser
            },
            message: 'User profile updated successfully'
        });
    } catch (error) {
        logger.error('Update user controller error:', error);
        
        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        if (error.message === 'EMAIL_UPDATE_NOT_ALLOWED') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'EMAIL_UPDATE_NOT_ALLOWED',
                    message: 'Email cannot be updated through this endpoint',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        if (error.message === 'PASSWORD_UPDATE_NOT_ALLOWED') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'PASSWORD_UPDATE_NOT_ALLOWED',
                    message: 'Password cannot be updated through this endpoint',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while updating user profile',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Delete user account
 * DELETE /api/v1/users/:id
 */
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Authorization check: users can only delete their own account (or admin can delete any)
        if (req.user.id !== id && req.user.role !== 'admin') {
            logger.warn(`Unauthorized delete attempt: User ${req.user.id} tried to delete user ${id}`);
            return res.status(403).json({
                success: false,
                error: {
                    code: 'AUTH_INSUFFICIENT_PERMISSIONS',
                    message: 'You can only delete your own account',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        const result = await userService.deleteUser(id);
        
        res.status(200).json({
            success: true,
            data: result,
            message: 'User account deleted successfully'
        });
    } catch (error) {
        logger.error('Delete user controller error:', error);
        
        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while deleting user account',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get user's auctions
 * GET /api/v1/users/:id/auctions
 */
export const getUserAuctions = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify user exists
        await userService.getUserById(id);
        
        // TODO: This will be implemented when Auction module is created
        // For now, return empty array as placeholder
        res.status(200).json({
            success: true,
            data: {
                auctions: [],
                message: 'Auction functionality will be available once the Auction module is implemented'
            }
        });
    } catch (error) {
        logger.error('Get user auctions controller error:', error);
        
        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while fetching user auctions',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Update notification preferences
 * PUT /api/v1/users/:id/notifications/preferences
 */
export const updateNotificationPreferences = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Authorization check: users can only modify their own preferences
        if (req.user.id !== id) {
            logger.warn(`Unauthorized preferences update: User ${req.user.id} tried to update preferences for user ${id}`);
            return res.status(403).json({
                success: false,
                error: {
                    code: 'AUTH_INSUFFICIENT_PERMISSIONS',
                    message: 'You can only update your own notification preferences',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        const preferences = req.body;
        
        const updatedPreferences = await userService.updateNotificationPreferences(id, preferences);
        
        res.status(200).json({
            success: true,
            data: {
                notificationPreferences: updatedPreferences
            },
            message: 'Notification preferences updated successfully'
        });
    } catch (error) {
        logger.error('Update notification preferences controller error:', error);
        
        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        if (error.message === 'NO_VALID_PREFERENCES_PROVIDED') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PREFERENCES',
                    message: 'No valid notification preferences provided',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while updating notification preferences',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get user statistics
 * GET /api/v1/users/:id/stats
 */
export const getUserStats = async (req, res) => {
    try {
        const { id } = req.params;
        
        const stats = await userService.getUserStats(id);
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Get user stats controller error:', error);
        
        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while fetching user statistics',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};
