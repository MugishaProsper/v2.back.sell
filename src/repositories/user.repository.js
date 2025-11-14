import User from '../models/user.model.js';
import logger from '../config/logger.js';

/**
 * UserRepository - Data access layer for User entity
 * Handles all database operations for users with query optimization
 */
class UserRepository {
    /**
     * Create a new user
     * @param {Object} userData - User data
     * @returns {Promise<Object>} - Created user
     */
    async create(userData) {
        try {
            const user = new User(userData);
            await user.save();
            logger.info(`User created: ${user.email}`);
            return user;
        } catch (error) {
            logger.error('Error creating user:', error.message);
            throw error;
        }
    }

    /**
     * Find user by ID with optional field projection
     * @param {string} userId - User ID
     * @param {Object} projection - Fields to include/exclude
     * @returns {Promise<Object|null>} - User or null
     */
    async findById(userId, projection = {}) {
        try {
            const user = await User.findById(userId).select(projection).lean();
            return user;
        } catch (error) {
            logger.error(`Error finding user by ID ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find user by email with optional field projection
     * @param {string} email - User email
     * @param {Object} projection - Fields to include/exclude
     * @returns {Promise<Object|null>} - User or null
     */
    async findByEmail(email, projection = {}) {
        try {
            const user = await User.findOne({ email }).select(projection).lean();
            return user;
        } catch (error) {
            logger.error(`Error finding user by email ${email}:`, error.message);
            throw error;
        }
    }

    /**
     * Update user by ID
     * @param {string} userId - User ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object|null>} - Updated user or null
     */
    async update(userId, updateData) {
        try {
            const user = await User.findByIdAndUpdate(
                userId,
                { $set: updateData },
                { new: true, runValidators: true }
            ).lean();
            
            if (user) {
                logger.info(`User updated: ${userId}`);
            }
            
            return user;
        } catch (error) {
            logger.error(`Error updating user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Delete user by ID (hard delete)
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} - Deleted user or null
     */
    async delete(userId) {
        try {
            const user = await User.findByIdAndDelete(userId).lean();
            
            if (user) {
                logger.info(`User deleted: ${userId}`);
            }
            
            return user;
        } catch (error) {
            logger.error(`Error deleting user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Anonymize user data (soft delete with data anonymization)
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} - Anonymized user or null
     */
    async anonymize(userId) {
        try {
            const anonymizedData = {
                email: `deleted_${userId}@anonymized.com`,
                'profile.firstName': 'Deleted',
                'profile.lastName': 'User',
                'profile.phone': null,
                'profile.avatar': null,
                'profile.address': {
                    street: null,
                    city: null,
                    state: null,
                    zipCode: null,
                    country: null
                },
                verified: false
            };

            const user = await User.findByIdAndUpdate(
                userId,
                { $set: anonymizedData },
                { new: true }
            ).lean();
            
            if (user) {
                logger.info(`User anonymized: ${userId}`);
            }
            
            return user;
        } catch (error) {
            logger.error(`Error anonymizing user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get user statistics
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} - User stats or null
     */
    async getUserStats(userId) {
        try {
            const user = await User.findById(userId)
                .select('stats email profile.firstName profile.lastName')
                .lean();
            
            return user;
        } catch (error) {
            logger.error(`Error getting user stats ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update user statistics
     * @param {string} userId - User ID
     * @param {Object} statsUpdate - Stats to update
     * @returns {Promise<Object|null>} - Updated user or null
     */
    async updateStats(userId, statsUpdate) {
        try {
            const updateFields = {};
            
            // Build update object with dot notation for nested fields
            Object.keys(statsUpdate).forEach(key => {
                updateFields[`stats.${key}`] = statsUpdate[key];
            });

            const user = await User.findByIdAndUpdate(
                userId,
                { $set: updateFields },
                { new: true }
            ).select('stats').lean();
            
            if (user) {
                logger.info(`User stats updated: ${userId}`);
            }
            
            return user;
        } catch (error) {
            logger.error(`Error updating user stats ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Increment user statistics
     * @param {string} userId - User ID
     * @param {Object} statsIncrement - Stats to increment
     * @returns {Promise<Object|null>} - Updated user or null
     */
    async incrementStats(userId, statsIncrement) {
        try {
            const incrementFields = {};
            
            // Build increment object with dot notation for nested fields
            Object.keys(statsIncrement).forEach(key => {
                incrementFields[`stats.${key}`] = statsIncrement[key];
            });

            const user = await User.findByIdAndUpdate(
                userId,
                { $inc: incrementFields },
                { new: true }
            ).select('stats').lean();
            
            if (user) {
                logger.info(`User stats incremented: ${userId}`);
            }
            
            return user;
        } catch (error) {
            logger.error(`Error incrementing user stats ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update notification preferences
     * @param {string} userId - User ID
     * @param {Object} preferences - Notification preferences
     * @returns {Promise<Object|null>} - Updated user or null
     */
    async updateNotificationPreferences(userId, preferences) {
        try {
            const updateFields = {};
            
            // Build update object with dot notation for nested fields
            Object.keys(preferences).forEach(key => {
                updateFields[`notificationPreferences.${key}`] = preferences[key];
            });

            const user = await User.findByIdAndUpdate(
                userId,
                { $set: updateFields },
                { new: true }
            ).select('notificationPreferences').lean();
            
            if (user) {
                logger.info(`User notification preferences updated: ${userId}`);
            }
            
            return user;
        } catch (error) {
            logger.error(`Error updating notification preferences ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find users by role with pagination
     * @param {string} role - User role
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @returns {Promise<Object>} - Users and pagination info
     */
    async findByRole(role, page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;
            
            const [users, total] = await Promise.all([
                User.find({ role })
                    .select('-password -passwordResetToken -passwordResetExpires')
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                User.countDocuments({ role })
            ]);

            return {
                users,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error(`Error finding users by role ${role}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if user exists by email
     * @param {string} email - User email
     * @returns {Promise<boolean>} - True if exists
     */
    async existsByEmail(email) {
        try {
            const count = await User.countDocuments({ email });
            return count > 0;
        } catch (error) {
            logger.error(`Error checking user existence ${email}:`, error.message);
            throw error;
        }
    }
}

export default new UserRepository();
