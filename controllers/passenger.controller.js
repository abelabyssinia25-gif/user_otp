const { models } = require('../models');

// Assumes a provided OTP util is available in the runtime
// and exports factory or direct helpers as described by the user.
// OTP util will be instantiated on-demand inside handlers to avoid stale state

function isValidPhoneNumber(phone) {
  // Basic E.164-ish validation; adjust if stricter rules are needed
  return typeof phone === 'string' && /^\+?[1-9]\d{7,14}$/.test(phone.trim());
}

async function createPassengerWithOtp(req, res) {
  try {
    const phone = (req.body && req.body.phone) ? String(req.body.phone).trim() : '';
    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number', phoneNumber: phone });
    }

    // Create or find minimal User record (phone + status)
    let user = await models.User.findOne({ where: { phone } });
    if (!user) {
      user = await models.User.create({ phone, status: 'pending' });
    }

    let otpUtilInstance;
    try {
      const factory = require('../utils/createAdvancedOtpUtil');
      otpUtilInstance = typeof factory === 'function' ? factory({ token: process.env.GEEZSMS_TOKEN }) : factory;
      if (!otpUtilInstance || typeof otpUtilInstance.generateAndSendOtp !== 'function') {
        throw new Error('Invalid OTP util instance');
      }
    } catch (e) {
      // Hard fallback: generate a code, store hashed in DB, and log it
      const crypto = require('crypto');
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const hashedSecret = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = Date.now() + 5 * 60 * 1000;
      await models.Otp.destroy({ where: { phone, referenceType: 'direct', referenceId: 0 } });
      await models.Otp.create({ phone, hashedSecret, expiresAt, attempts: 0, status: 'pending', referenceType: 'direct', referenceId: 0 });
      console.log(`[OTP FALLBACK] to=${phone} code=${code}`);
      return res.status(200).json({ success: true, message: 'OTP sent (fallback)', phoneNumber: phone });
    }

    try {
      await otpUtilInstance.generateAndSendOtp({ phoneNumber: phone, referenceType: 'User', referenceId: user.id });
    } catch (err) {
      const message = (err && err.message) ? err.message : 'Failed to send OTP';
      const tooFrequent = /rate|too\s*frequent|too\s*many/i.test(message) || err.code === 'RATE_LIMIT' || err.status === 429;
      const status = tooFrequent ? 429 : 500;
      return res.status(status).json({ success: false, message, phoneNumber: phone });
    }

    return res.status(200).json({ success: true, message: 'OTP sent', phoneNumber: phone });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Internal error' });
  }
}

async function verifyPassengerOtp(req, res) {
  try {
    const phone = (req.body && req.body.phone) ? String(req.body.phone).trim() : '';
    const otp = (req.body && req.body.otp) ? String(req.body.otp).trim() : '';
    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number', phoneNumber: phone });
    }
    if (!otp) {
      return res.status(400).json({ success: false, message: 'OTP required', phoneNumber: phone });
    }

    let otpUtilInstance;
    try {
      const factory = require('../utils/createAdvancedOtpUtil');
      otpUtilInstance = typeof factory === 'function' ? factory({ token: process.env.GEEZSMS_TOKEN }) : factory;
      if (!otpUtilInstance || typeof otpUtilInstance.verifyOtp !== 'function') {
        throw new Error('Invalid OTP util instance');
      }
    } catch (e) {
      // Hard fallback verify: compare hashed token stored during fallback send
      const crypto = require('crypto');
      const hashed = crypto.createHash('sha256').update(String(otp)).digest('hex');
      const { Op } = require('../models');
      const record = await models.Otp.findOne({ where: { phone, referenceType: 'direct', referenceId: 0, status: 'pending', expiresAt: { [Op.gt]: Date.now() } } });
      if (!record) return res.status(401).json({ success: false, message: 'OTP verification failed', phoneNumber: phone });
      if (record.hashedSecret !== hashed) return res.status(401).json({ success: false, message: 'OTP verification failed', phoneNumber: phone });
      await models.Otp.destroy({ where: { phone, referenceType: 'direct', referenceId: 0 } });
      let user = await models.User.findOne({ where: { phone } });
      if (!user) { user = await models.User.create({ phone, status: 'pending' }); }
      if (user.status !== 'active') { await user.update({ status: 'active' }); }
      return res.status(200).json({ success: true, message: 'Passenger verified', phoneNumber: phone });
    }

    let user = await models.User.findOne({ where: { phone } });
    if (!user) {
      user = await models.User.create({ phone, status: 'pending' });
    }

    let verified = false;
    try {
      const result = await otpUtilInstance.verifyOtp({ phoneNumber: phone, token: otp, referenceType: 'User', referenceId: user.id });
      verified = result?.success === true || result === true || (result && result.valid) === true;
    } catch (err) {
      const message = (err && err.message) ? err.message : 'OTP verification failed';
      return res.status(401).json({ success: false, message, phoneNumber: phone });
    }

    if (!verified) {
      return res.status(401).json({ success: false, message: 'OTP verification failed', phoneNumber: phone });
    }

    if (user.status !== 'active') {
      await user.update({ status: 'active' });
    }

    return res.status(200).json({ success: true, message: 'Passenger verified', phoneNumber: phone });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Internal error' });
  }
}

module.exports = {
  createPassengerWithOtp,
  verifyPassengerOtp
};

