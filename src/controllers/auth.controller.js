import authService from '../services/auth.service.js';
import logger from '../config/logger.js';
import { validateRegistration, validateLogin, sanitizeInput } from '../utils/validation.js';

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
export const register = async (req, res) => {
    try {
        const { email, password, firstName, lastName, role } = req.body;
        
        // Validate input
        const validation = validateRegistration({ email, password });
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_FAILED',
                    message: 'Validation failed',
                    details: validation.errors,
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        // Sanitize inputs
        const sanitizedData = {
            email: sanitizeInput(email.toLowerCase()),
            password,
            firstName: firstName ? sanitizeInput(firstName) : undefined,
            lastName: lastName ? sanitizeInput(lastName) : undefined,
            role: role && ['buyer', 'seller', 'admin'].includes(role) ? role : 'buyer'
        };
        
        // Register user
        const result = await authService.register(sanitizedData);
        
        // Set refresh token in httpOnly cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        res.status(201).json({
            success: true,
            data: {
                user: result.user,
                accessToken: result.accessToken
            },
            message: 'User registered successfully'
        });
    } catch (error) {
        logger.error('Register controller error:', error);
        
        if (error.message === 'EMAIL_ALREADY_EXISTS') {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'EMAIL_ALREADY_EXISTS',
                    message: 'Email is already registered',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        if (error.message === 'INVALID_EMAIL_FORMAT') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_EMAIL_FORMAT',
                    message: 'Invalid email format',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        if (error.message === 'PASSWORD_TOO_SHORT') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'PASSWORD_TOO_SHORT',
                    message: 'Password must be at least 8 characters long',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred during registration',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Login user
 * POST /api/v1/auth/login
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate input
        const validation = validateLogin({ email, password });
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_FAILED',
                    message: 'Validation failed',
                    details: validation.errors,
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        // Login user
        const result = await authService.login(email.toLowerCase(), password);
        
        // Set refresh token in httpOnly cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        res.status(200).json({
            success: true,
            data: {
                user: result.user,
                accessToken: result.accessToken
            },
            message: 'Login successful'
        });
    } catch (error) {
        logger.error('Login controller error:', error);
        
        if (error.message === 'INVALID_CREDENTIALS') {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_INVALID_CREDENTIALS',
                    message: 'Invalid email or password',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred during login',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Refresh access token
 * POST /api/v1/auth/refresh-token
 */
export const refreshToken = async (req, res) => {
    try {
        // Get refresh token from cookie or body
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        
        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'REFRESH_TOKEN_MISSING',
                    message: 'Refresh token is required',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        // Refresh token
        const result = await authService.refreshToken(refreshToken);
        
        res.status(200).json({
            success: true,
            data: {
                accessToken: result.accessToken
            },
            message: 'Token refreshed successfully'
        });
    } catch (error) {
        logger.error('Refresh token controller error:', error);
        
        if (error.message === 'INVALID_REFRESH_TOKEN') {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_REFRESH_TOKEN',
                    message: 'Invalid refresh token',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        if (error.message === 'REFRESH_TOKEN_EXPIRED') {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'REFRESH_TOKEN_EXPIRED',
                    message: 'Refresh token has expired',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
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
                message: 'An error occurred during token refresh',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get current user
 * GET /api/v1/auth/me
 */
export const getCurrentUser = async (req, res) => {
    try {
        const user = await authService.getUserById(req.user.id);
        
        res.status(200).json({
            success: true,
            data: {
                user
            }
        });
    } catch (error) {
        logger.error('Get current user controller error:', error);
        
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
 * Logout user
 * POST /api/v1/auth/logout
 */
export const logout = async (req, res) => {
    try {
        // Clear refresh token cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        
        logger.info(`User logged out: ${req.user.email}`);
        
        res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        logger.error('Logout controller error:', error);
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred during logout',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};
