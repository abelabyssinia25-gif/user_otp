const axios = require('axios');
const createAdvancedOtpUtil = require('./createAdvancedOtpUtil');
const { models } = require('../models');

const GEEZSMS_TOKEN = process.env.GEEZSMS_TOKEN || 'ZPdv3rC9RU1an22XJWWX9XiUGGLjHcdF';

const otpUtil = createAdvancedOtpUtil({
  token: GEEZSMS_TOKEN,
  otpLength: 6,
  otpExpirationSeconds: 300,
  maxAttempts: 3,
  lockoutSeconds: 1800,
});

async function createPassengerWithOtp(phoneNumber) {
  try {
    let passenger = await models.User.findOne({ where: { phone: phoneNumber } });
    if (!passenger) {
      passenger = await models.User.create({ phone: phoneNumber, status: 'pending' });
    }

    const otpResponse = await otpUtil.generateAndSendOtp({
      referenceType: 'User',
      referenceId: passenger.id,
      phoneNumber,
    });

    return {
      success: true,
      message: 'Passenger created and OTP sent',
      phoneNumber: otpResponse.phoneNumber || phoneNumber,
      expiresIn: otpResponse.expiresIn,
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function verifyPassengerOtp(userId, token) {
  try {
    const verifyResponse = await otpUtil.verifyOtp({
      referenceType: 'User',
      referenceId: userId,
      token,
    });

    const passenger = await models.User.findByPk(userId);
    if (passenger && passenger.status !== 'active') {
      passenger.status = 'active';
      await passenger.save();
    }

    return {
      success: true,
      message: 'OTP verified, passenger activated',
      phoneNumber: passenger ? passenger.phone : undefined,
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

module.exports = { createPassengerWithOtp, verifyPassengerOtp };
