const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const auth = require('../middleware/auth');
const { requirePermissions } = require('../middleware/rbac');

router.post('/', auth(), requirePermissions('admin:create'), ctrl.create);
router.get('/', auth(), requirePermissions('admin:read'), ctrl.list);
router.get('/:id', auth(), requirePermissions('admin:read'), ctrl.get);
router.put('/:id', auth(), requirePermissions('admin:update'), ctrl.update);
router.delete('/:id', auth(), requirePermissions('admin:delete'), ctrl.remove);

router.post('/drivers/:driverId/approve', auth(), requirePermissions('driver:approve'), ctrl.approveDriver);
router.post('/drivers/:driverId/documents/approve', auth(), requirePermissions('driver:documents:approve'), ctrl.approveDriverDocuments);
router.post('/drivers/:driverId/documents/reject', auth(), requirePermissions('driver:documents:approve'), ctrl.rejectDriverDocuments);
router.get('/drivers/pending-documents', auth(), requirePermissions('driver:documents:approve'), ctrl.getPendingDriverDocuments);

// Reward points management
router.post('/drivers/:driverId/reward-points', auth(), requirePermissions('driver:update'), ctrl.awardDriverPoints);
router.post('/passengers/:passengerId/reward-points', auth(), requirePermissions('passenger:update'), ctrl.awardPassengerPoints);

router.get('/users/filter', auth(), requirePermissions('user:read'), ctrl.filterByRole);

// Admin can get staff by their role
router.get('/staff', auth(), requirePermissions('staff:read'), ctrl.listStaffByRole);

module.exports = router;
