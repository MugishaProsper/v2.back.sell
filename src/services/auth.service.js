import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import crypto from 'crypto';
import cacheService from './cache.service.js';
import prometheusMetrics from './prometheus-metrics.service.js';

class AuthService {
    /**
     * Register a new user
     * @param {Object} userData - User registration data
     * @returns {Object} - Created user and tokens
     */
    async register(userData) {
        const { email, password, firstName, lastName, role } = userData;
        
        try {
            // Log registration attempt
            logger.info(`Registration attempt for email: ${email}`);
            
            // Check if user already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                logger.warn(`Registration failed: Email already exists - ${email}`);
                throw new Error('EMAIL_ALREADY_EXISTS');
            }
            
            // Validate email format
            const emailRegex = /^\S+@\S+\.\S+$/;
            if (!emailRegex.test(email)) {
                logger.warn(`Registration failed: Invalid email format - ${email}`);
                throw new Error('INVALID_EMAIL_FORMAT');
            }
            
            // Validate password strength
            if (password.length < 8) {
                logger.warn(`Registration failed: Password too short - ${email}`);
                throw new Error('PASSWORD_TOO_SHORT');
            }
            
            // Create new user
            const user = new User({
                email,
                password, // Will be hashed by pre-save hook
                profile: {
                    firstName,
                    lastName
                },
                role: role || 'buyer'
            });
            
            await user.save();
            
            // Track user registration metric
            prometheusMetrics.trackUserRegistration(user.role || 'buyer');
            
            // Generate tokens
            const tokens = user.generateTokens();
            
            // Remove password from response
            const userResponse = user.toObject();
            delete userResponse.password;
            
            logger.info(`User registered successfully: ${email}`);
            
            return {
                user: userResponse,
                ...tokens
            };
        } catch (error) {
            logger.error(`Registration error for ${email}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Login user with credentials
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Object} - User and tokens
     */
    async login(email, password) {
        try {
            // Log login attempt
            logger.info(`Login attempt for email: ${email}`);
            
            // Find user with password field
            const user = await User.findOne({ email }).select('+password');
            
            if (!user) {
                logger.warn(`Login failed: User not found - ${email}`);
                throw new Error('INVALID_CREDENTIALS');
            }
            
            // Verify password
            const isPasswordValid = await user.comparePassword(password);
            
            if (!isPasswordValid) {
                logger.warn(`Login failed: Invalid password - ${email}`);
                throw new Error('INVALID_CREDENTIALS');
            }
            
            // Update last login
            user.lastLogin = new Date();
            await user.save();
            
            // Generate tokens
            const tokens = user.generateTokens();
            
            // Remove password from response
            const userResponse = user.toObject();
            delete userResponse.password;
            
            // Cache user session data (TTL: 15 minutes)
            await cacheService.cacheUserSession(user._id.toString(), {
                userId: user._id,
                email: user.email,
                role: user.role,
                profile: user.profile,
                lastLogin: user.lastLogin
            });
            
            logger.info(`User logged in successfully: ${email}`);
            
            return {
                user: userResponse,
                ...tokens
            };
        } catch (error) {
            logger.error(`Login error for ${email}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Refresh access token using refresh token
     * @param {string} refreshToken - Refresh token
     * @returns {Object} - New access token
     */
    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            
            // Find user
            const user = await User.findById(decoded.id);
            
            if (!user) {
                logger.warn(`Token refresh failed: User not found - ${decoded.id}`);
                throw new Error('USER_NOT_FOUND');
            }
            
            // Generate new access token
            const accessToken = user.generateAccessToken();
            
            logger.info(`Token refreshed successfully for user: ${user.email}`);
            
            return {
                accessToken
            };
        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                logger.warn('Token refresh failed: Invalid token');
                throw new Error('INVALID_REFRESH_TOKEN');
            }
            if (error.name === 'TokenExpiredError') {
                logger.warn('Token refresh failed: Token expired');
                throw new Error('REFRESH_TOKEN_EXPIRED');
            }
            logger.error('Token refresh error:', error.message);
            throw error;
        }
    }
    
    /**
     * Get user by ID (with caching)
     * @param {string} userId - User ID
     * @returns {Object} - User object
     */
    async getUserById(userId) {
        try {
            // Try to get from cache first
            const cachedSession = await cacheService.getUserSession(userId);
            if (cachedSession) {
                logger.debug(`User session retrieved from cache: ${userId}`);
                return cachedSession;
            }
            
            // If not in cache, fetch from database
            const user = await User.findById(userId);
            
            if (!user) {
                throw new Error('USER_NOT_FOUND');
            }
            
            // Cache the user session
            await cacheService.cacheUserSession(userId, {
                userId: user._id,
                email: user.email,
                role: user.role,
                profile: user.profile,
                lastLogin: user.lastLogin
            });
            
            return user;
        } catch (error) {
            logger.error(`Get user error for ${userId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Logout user (invalidate session cache)
     * @param {string} userId - User ID
     * @returns {Object} - Success message
     */
    async logout(userId) {
        try {
            // Invalidate user session cache
            await cacheService.invalidateUserSession(userId);
            logger.info(`User logged out: ${userId}`);
            
            return {
                message: 'Logout successful'
            };
        } catch (error) {
            logger.error(`Logout error for ${userId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Generate password reset token
     * @param {string} email - User email
     * @returns {Object} - Reset token and expiry
     */
    async generatePasswordResetToken(email) {
        try {
            logger.info(`Password reset requested for email: ${email}`);
            
            const user = await User.findOne({ email });
            
            if (!user) {
                // Don't reveal if user exists or not for security
                logger.warn(`Password reset: User not found - ${email}`);
                return {
                    message: 'If the email exists, a reset link will be sent'
                };
            }
            
            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenHash = crypto
                .createHash('sha256')
                .update(resetToken)
                .digest('hex');
            
            // Store hashed token and expiry (1 hour)
            user.passwordResetToken = resetTokenHash;
            user.passwordResetExpires = Date.now() + 3600000; // 1 hour
            await user.save();
            
            logger.info(`Password reset token generated for: ${email}`);
            
            return {
                resetToken,
                email: user.email
            };
        } catch (error) {
            logger.error(`Password reset token generation error:`, error.message);
            throw error;
        }
    }
    
    /**
     * Reset password using reset token
     * @param {string} resetToken - Password reset token
     * @param {string} newPassword - New password
     * @returns {Object} - Success message
     */
    async resetPassword(resetToken, newPassword) {
        try {
            // Hash the token to compare with stored hash
            const resetTokenHash = crypto
                .createHash('sha256')
                .update(resetToken)
                .digest('hex');
            
            // Find user with valid reset token
            const user = await User.findOne({
                passwordResetToken: resetTokenHash,
                passwordResetExpires: { $gt: Date.now() }
            });
            
            if (!user) {
                logger.warn('Password reset failed: Invalid or expired token');
                throw new Error('INVALID_OR_EXPIRED_TOKEN');
            }
            
            // Validate new password
            if (newPassword.length < 8) {
                throw new Error('PASSWORD_TOO_SHORT');
            }
            
            // Update password (will be hashed by pre-save hook)
            user.password = newPassword;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();
            
            logger.info(`Password reset successfully for user: ${user.email}`);
            
            return {
                message: 'Password reset successful'
            };
        } catch (error) {
            logger.error('Password reset error:', error.message);
            throw error;
        }
    }
    
    /**
     * Verify JWT token
     * @param {string} token - JWT token
     * @returns {Object} - Decoded token payload
     */
    verifyAccessToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                throw new Error('INVALID_TOKEN');
            }
            if (error.name === 'TokenExpiredError') {
                throw new Error('TOKEN_EXPIRED');
            }
            throw error;
        }
    }
}

export default new AuthService();
