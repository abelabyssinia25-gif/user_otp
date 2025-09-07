const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tripController');
const auth = require('../middleware/auth');
const { requirePermissions } = require('../middleware/rbac');

// Trip management routes
router.post('/', auth(), ctrl.createTrip);
router.post('/:tripId/accept', auth(), ctrl.acceptTrip);
router.post('/:tripId/start', auth(), ctrl.startTrip);
router.post('/:tripId/complete', auth(), ctrl.completeTrip);

// Rating routes
router.post('/:tripId/rate-passenger', auth(), ctrl.ratePassenger);
router.post('/:tripId/rate-driver', auth(), ctrl.rateDriver);

// Trip history
router.get('/history/:userType/:userId', auth(), requirePermissions('trip:read'), ctrl.getTripHistory);

module.exports = router;
