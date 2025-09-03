const { models } = require('../models');
const { generateUserToken } = require('../utils/jwt');
const createAdvancedOtpUtil = require('../utils/createAdvancedOtpUtil');

// Initialize OTP utility
const otpUtil = createAdvancedOtpUtil({
  token: process.env.GEEZSMS_TOKEN,
  otpLength: 6,
  otpExpirationSeconds: 300, // 5 minutes
  maxAttempts: 3,
  lockoutSeconds: 1800, // 30 minutes
});

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleanPhone = phone.replace(/\D/g, '');
  // Accept Ethiopian format: 09XXXXXXXX or 07XXXXXXXX, or international +2519XXXXXXXX
  return /^(09|07)\d{8}$/.test(cleanPhone) || /^\+?251(9|7)\d{8}$/.test(phone);
}

/**
 * Normalize phone number to international format
 * @param {string} phone - Phone number to normalize
 * @returns {string} Normalized phone number
 */
function normalizePhone(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('09') || cleanPhone.startsWith('07')) {
    return '+251' + cleanPhone.substring(1);
  }
  if (cleanPhone.startsWith('251')) {
    return '+' + cleanPhone;
  }
  return phone;
}

/**
 * Request OTP for phone number
 * POST /auth/request-otp
 */
async function requestOtp(req, res) {
  try {
    const { phone } = req.body;

    // Validate input
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use 09XXXXXXXX or 07XXXXXXXX'
      });
    }

    const normalizedPhone = normalizePhone(phone);

    // Create or find user with pending status
    let user = await models.User.findOne({ where: { phone: normalizedPhone } });
    if (!user) {
      user = await models.User.create({ 
        phone: normalizedPhone, 
        status: 'pending' 
      });
    }

    // Generate and send OTP
    try {
      const otpResponse = await otpUtil.generateAndSendOtp({
        referenceType: 'User',
        referenceId: user.id,
        phoneNumber: normalizedPhone
      });

      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        phoneNumber: normalizedPhone,
        expiresIn: otpResponse.expiresIn
      });
    } catch (otpError) {
      // Handle rate limiting and other OTP errors
      if (otpError.message.includes('wait') || otpError.message.includes('locked')) {
        return res.status(429).json({
          success: false,
          message: otpError.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Request OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Verify OTP and activate user account
 * POST /auth/verify-otp
 */
async function verifyOtp(req, res) {
  try {
    const { phone, otp } = req.body;

    // Validate input
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }

    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    const normalizedPhone = normalizePhone(phone);

    // Find user
    const user = await models.User.findOne({ where: { phone: normalizedPhone } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please request OTP first.'
      });
    }

    // Verify OTP
    try {
      await otpUtil.verifyOtp({
        referenceType: 'User',
        referenceId: user.id,
        token: otp,
        phoneNumber: normalizedPhone
      });

      // Activate user account
      if (user.status !== 'active') {
        await user.update({ status: 'active' });
      }

      // Generate JWT token
      const token = generateUserToken(user);

      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully. Account activated.',
        user: {
          id: user.id,
          phone: user.phone,
          status: 'active'
        },
        token
      });
    } catch (otpError) {
      // Handle OTP verification errors
      if (otpError.message.includes('expired')) {
        return res.status(400).json({
          success: false,
          message: 'OTP has expired. Please request a new one.'
        });
      }
      
      if (otpError.message.includes('locked')) {
        return res.status(429).json({
          success: false,
          message: otpError.message
        });
      }
      
      if (otpError.message.includes('Invalid') || otpError.message.includes('No valid')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP. Please check and try again.'
        });
      }

      return res.status(400).json({
        success: false,
        message: 'OTP verification failed. Please try again.'
      });
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Login with phone number (for already verified users)
 * POST /auth/login
 */
async function loginWithPhone(req, res) {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    const normalizedPhone = normalizePhone(phone);

    // Find active user
    const user = await models.User.findOne({ 
      where: { 
        phone: normalizedPhone,
        status: 'active'
      } 
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or not verified. Please verify your phone number first.'
      });
    }

    // Generate JWT token
    const token = generateUserToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        phone: user.phone,
        status: user.status
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Get user profile (protected route)
 * GET /auth/profile
 */
async function getUserProfile(req, res) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

module.exports = {
  requestOtp,
  verifyOtp,
  loginWithPhone,
  getUserProfile
};
