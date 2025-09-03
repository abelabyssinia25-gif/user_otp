const { verifyToken } = require('../utils/jwt');
const { models } = require('../models');

/**
 * Middleware to authenticate phone-based users
 * Verifies JWT token and attaches user to request
 */
async function authenticatePhoneUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = verifyToken(token);
      
      // Verify token is for phone user
      if (decoded.type !== 'user' || !decoded.verified) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type'
        });
      }

      // Check if user still exists and is active
      const user = await models.User.findByPk(decoded.id);
      if (!user || user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Attach user to request
      req.user = {
        id: user.id,
        phone: user.phone,
        status: user.status
      };

      next();
    } catch (tokenError) {
      if (tokenError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      
      if (tokenError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Token verification failed'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't block request if invalid
 */
async function optionalPhoneAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = verifyToken(token);
      
      if (decoded.type === 'user' && decoded.verified) {
        const user = await models.User.findByPk(decoded.id);
        if (user && user.status === 'active') {
          req.user = {
            id: user.id,
            phone: user.phone,
            status: user.status
          };
        }
      }
    } catch (tokenError) {
      // Ignore token errors for optional auth
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // Continue even if auth fails
  }
}

module.exports = {
  authenticatePhoneUser,
  optionalPhoneAuth
};
