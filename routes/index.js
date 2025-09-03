const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/auth', require('./phoneAuthRoutes')); // Phone-based authentication
router.use('/passengers', require('./passengerRoutes'));
router.use('/drivers', require('./driverRoutes'));
router.use('/staff', require('./staffRoutes'));
router.use('/roles', require('./roleRoutes'));
router.use('/permissions', require('./permissionRoutes'));
router.use('/admins', require('./adminRoutes'));
router.use('/v1/passengers', require('./v1/passenger.routes'));

// Public OTP endpoints (no versioned prefix as requested)
const passengerOtpCtrl = require('../controllers/passenger.controller');
router.post('/createPassengerWithOtp', passengerOtpCtrl.createPassengerWithOtp);
router.post('/verifyPassengerOtp', passengerOtpCtrl.verifyPassengerOtp);

module.exports = router;
