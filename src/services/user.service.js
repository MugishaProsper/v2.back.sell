import userRepository from '../repositories/user.repository.js';
import logger from '../config/logger.js';

/**
 * UserService - Business logic layer for User management
 * Handles user profile updates, deletion, notification preferences, and statistics
 */
class UserService {
    /**
     * Get user by ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - User object
     */
    async getUserById(userId) {
        try {
            const user = await userRepository.findById(userId, '-password -passwordResetToken -passwordResetExpires');
            
            if (!user) {
                throw new Error('USER_NOT_FOUND');
            }
            
            return user;
        } catch (error) {
            logger.error(`Get user by ID error for ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update user profile
     * @param {string} userId - User ID
     * @param {Object} updateData - Profile data to update
     * @returns {Promise<Object>} - Updated user
     */
    async updateProfile(userId, updateData) {
        try {
            // Validate that user exists
            const existingUser = await userRepository.findById(userId);
            
            if (!existingUser) {
                throw new Error('USER_NOT_FOUND');
            }

            // Prevent updating sensitive fields
            const allowedFields = [
                'profile.firstName',
                'profile.lastName',
                'profile.phone',
                'profile.avatar',
                'profile.address.street',
                'profile.address.city',
                'profile.address.state',
                'profile.address.zipCode',
                'profile.address.country'
            ];

            const sanitizedUpdate = {};
            
            // Handle nested profile updates
            if (updateData.profile) {
                Object.keys(updateData.profile).forEach(key => {
                    if (key === 'address' && typeof updateData.profile.address === 'object') {
                        // Handle address object
                        Object.keys(updateData.profile.address).forEach(addressKey => {
                            sanitizedUpdate[`profile.address.${addressKey}`] = updateData.profile.address[addressKey];
                        });
                    } else {
                        sanitizedUpdate[`profile.${key}`] = updateData.profile[key];
                    }
                });
            }

            // Validate email if provided (but don't allow update through this method)
            if (updateData.email) {
                logger.warn(`Attempt to update email through profile update for user ${userId}`);
                throw new Error('EMAIL_UPDATE_NOT_ALLOWED');
            }

            // Validate password (not allowed through this method)
            if (updateData.password) {
                logger.warn(`Attempt to update password through profile update for user ${userId}`);
                throw new Error('PASSWORD_UPDATE_NOT_ALLOWED');
            }

            const updatedUser = await userRepository.update(userId, sanitizedUpdate);
            
            if (!updatedUser) {
                throw new Error('USER_UPDATE_FAILED');
            }

            logger.info(`User profile updated successfully: ${userId}`);
            
            return updatedUser;
        } catch (error) {
            logger.error(`Update profile error for ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Delete user with data anonymization (GDPR compliant)
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - Result message
     */
    async deleteUser(userId) {
        try {
            // Validate that user exists
            const existingUser = await userRepository.findById(userId);
            
            if (!existingUser) {
                throw new Error('USER_NOT_FOUND');
            }

            // Anonymize user data instead of hard delete (GDPR compliant)
            const anonymizedUser = await userRepository.anonymize(userId);
            
            if (!anonymizedUser) {
                throw new Error('USER_DELETION_FAILED');
            }

            logger.info(`User deleted (anonymized) successfully: ${userId}`);
            
            return {
                message: 'User account deleted successfully',
                userId
            };
        } catch (error) {
            logger.error(`Delete user error for ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update notification preferences
     * @param {string} userId - User ID
     * @param {Object} preferences - Notification preferences
     * @returns {Promise<Object>} - Updated preferences
     */
    async updateNotificationPreferences(userId, preferences) {
        try {
            // Validate that user exists
            const existingUser = await userRepository.findById(userId);
            
            if (!existingUser) {
                throw new Error('USER_NOT_FOUND');
            }

            // Validate preference fields
            const allowedPreferences = ['email', 'inApp', 'bidUpdates', 'auctionUpdates', 'marketing'];
            const sanitizedPreferences = {};

            Object.keys(preferences).forEach(key => {
                if (allowedPreferences.includes(key) && typeof preferences[key] === 'boolean') {
                    sanitizedPreferences[key] = preferences[key];
                }
            });

            if (Object.keys(sanitizedPreferences).length === 0) {
                throw new Error('NO_VALID_PREFERENCES_PROVIDED');
            }

            const updatedUser = await userRepository.updateNotificationPreferences(userId, sanitizedPreferences);
            
            if (!updatedUser) {
                throw new Error('PREFERENCES_UPDATE_FAILED');
            }

            logger.info(`Notification preferences updated for user: ${userId}`);
            
            return updatedUser.notificationPreferences;
        } catch (error) {
            logger.error(`Update notification preferences error for ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get user statistics
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - User statistics
     */
    async getUserStats(userId) {
        try {
            const user = await userRepository.getUserStats(userId);
            
            if (!user) {
                throw new Error('USER_NOT_FOUND');
            }

            return {
                userId: user._id,
                email: user.email,
                name: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
                stats: user.stats
            };
        } catch (error) {
            logger.error(`Get user stats error for ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update user statistics
     * @param {string} userId - User ID
     * @param {Object} statsUpdate - Statistics to update
     * @returns {Promise<Object>} - Updated statistics
     */
    async updateUserStats(userId, statsUpdate) {
        try {
            // Validate allowed stat fields
            const allowedStats = ['auctionsCreated', 'auctionsWon', 'totalBids', 'totalSpent'];
            const sanitizedStats = {};

            Object.keys(statsUpdate).forEach(key => {
                if (allowedStats.includes(key) && typeof statsUpdate[key] === 'number') {
                    sanitizedStats[key] = statsUpdate[key];
                }
            });

            if (Object.keys(sanitizedStats).length === 0) {
                throw new Error('NO_VALID_STATS_PROVIDED');
            }

            const updatedUser = await userRepository.updateStats(userId, sanitizedStats);
            
            if (!updatedUser) {
                throw new Error('USER_NOT_FOUND');
            }

            logger.info(`User stats updated for: ${userId}`);
            
            return updatedUser.stats;
        } catch (error) {
            logger.error(`Update user stats error for ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Increment user statistics
     * @param {string} userId - User ID
     * @param {Object} statsIncrement - Statistics to increment
     * @returns {Promise<Object>} - Updated statistics
     */
    async incrementUserStats(userId, statsIncrement) {
        try {
            // Validate allowed stat fields
            const allowedStats = ['auctionsCreated', 'auctionsWon', 'totalBids', 'totalSpent'];
            const sanitizedStats = {};

            Object.keys(statsIncrement).forEach(key => {
                if (allowedStats.includes(key) && typeof statsIncrement[key] === 'number') {
                    sanitizedStats[key] = statsIncrement[key];
                }
            });

            if (Object.keys(sanitizedStats).length === 0) {
                throw new Error('NO_VALID_STATS_PROVIDED');
            }

            const updatedUser = await userRepository.incrementStats(userId, sanitizedStats);
            
            if (!updatedUser) {
                throw new Error('USER_NOT_FOUND');
            }

            logger.info(`User stats incremented for: ${userId}`);
            
            return updatedUser.stats;
        } catch (error) {
            logger.error(`Increment user stats error for ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get users by role with pagination
     * @param {string} role - User role
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @returns {Promise<Object>} - Users and pagination info
     */
    async getUsersByRole(role, page = 1, limit = 10) {
        try {
            const validRoles = ['buyer', 'seller', 'admin'];
            
            if (!validRoles.includes(role)) {
                throw new Error('INVALID_ROLE');
            }

            const result = await userRepository.findByRole(role, page, limit);
            
            return result;
        } catch (error) {
            logger.error(`Get users by role error for ${role}:`, error.message);
            throw error;
        }
    }
}

export default new UserService();
