
const express = require('express');
const { createPassengerWithOtp, verifyPassengerOtp } = require('../../controllers/passenger.controller');
const router = express.Router();

// Public endpoints for passenger OTP flow
router.post('/otp/create', createPassengerWithOtp);
router.post('/otp/verify', verifyPassengerOtp);

module.exports = router;

