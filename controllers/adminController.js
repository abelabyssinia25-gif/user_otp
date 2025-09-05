const { models, Op } = require('../models');
const { hashPassword } = require('../utils/password');

exports.create = async (req, res) => {
try {
const data = req.body;
if (data.password) data.password = await hashPassword(data.password);
const row = await models.Admin.create(data);
return res.status(201).json(row);
} catch (e) { return res.status(500).json({ message: e.message }); }
};
exports.list = async (req, res) => { try { const rows = await models.Admin.findAll({ include: ['roles'] }); return res.json(rows); } catch (e) { return res.status(500).json({ message: e.message }); } };
exports.get = async (req, res) => { try { const row = await models.Admin.findByPk(req.params.id, { include: ['roles'] }); if (!row) return res.status(404).json({ message: 'Not found' }); return res.json(row); } catch (e) { return res.status(500).json({ message: e.message }); } };
exports.update = async (req, res) => {
try {
const data = req.body;
if (data.password) data.password = await hashPassword(data.password);
const [count] = await models.Admin.update(data, { where: { id: req.params.id } });
if (!count) return res.status(404).json({ message: 'Not found' });
const updated = await models.Admin.findByPk(req.params.id);
return res.json(updated);
} catch (e) { return res.status(500).json({ message: e.message }); }
};
exports.remove = async (req, res) => { try { const count = await models.Admin.destroy({ where: { id: req.params.id } }); if (!count) return res.status(404).json({ message: 'Not found' }); return res.status(204).send(); } catch (e) { return res.status(500).json({ message: e.message }); } };

exports.approveDriver = async (req, res) => {
try {
const driver = await models.Driver.findByPk(req.params.driverId);
if (!driver) return res.status(404).json({ message: 'Driver not found' });
driver.verification = true;
driver.documentStatus = 'approved';
await driver.save();
return res.json(driver);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.approveDriverDocuments = async (req, res) => {
try {
const driver = await models.Driver.findByPk(req.params.driverId);
if (!driver) return res.status(404).json({ message: 'Driver not found' });
driver.documentStatus = 'approved';
await driver.save();
return res.json(driver);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.rejectDriverDocuments = async (req, res) => {
try {
const driver = await models.Driver.findByPk(req.params.driverId);
if (!driver) return res.status(404).json({ message: 'Driver not found' });
driver.documentStatus = 'rejected';
await driver.save();
return res.json(driver);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.getPendingDriverDocuments = async (req, res) => {
try {
const drivers = await models.Driver.findAll({
where: {
  [Op.and]: [
    { [Op.or]: [{ documentStatus: 'pending' }, { documentStatus: null }] },
    { [Op.or]: [
      { drivingLicenseFile: { [Op.ne]: null } },
      { nationalIdFile: { [Op.ne]: null } },
      { vehicleRegistrationFile: { [Op.ne]: null } },
      { insuranceFile: { [Op.ne]: null } },
      { document: { [Op.ne]: null } },
    ]}
  ]
}
});
return res.json(drivers);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.filterByRole = async (req, res) => {
try {
const { role } = req.query;
if (!role) return res.status(400).json({ message: 'Role parameter is required' });

let users = [];
switch (role.toLowerCase()) {
case 'passenger':
users = await models.Passenger.findAll({ include: ['roles'] });
break;
case 'driver':
users = await models.Driver.findAll({ include: ['roles'] });
break;
case 'staff':
users = await models.Staff.findAll({ include: ['roles'] });
break;
case 'admin':
users = await models.Admin.findAll({ include: ['roles'] });
break;
default:
return res.status(400).json({ message: 'Invalid role. Use: passenger, driver, staff, admin' });
}

return res.json(users);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.listStaffByRole = async (req, res) => {
try {
const { role } = req.query; // role name like 'dispatcher', 'finance'
const include = role ? [{ association: 'roles', where: { name: role }, required: true }] : ['roles'];
const staff = await models.Staff.findAll({ include });
return res.json(staff);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

// Award reward points to a driver (admin-only)
exports.awardDriverPoints = async (req, res) => {
try {
const { driverId } = req.params;
const { points } = req.body;
const amount = Number(points);
if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ message: 'points must be a non-zero number' });
const driver = await models.Driver.findByPk(driverId);
if (!driver) return res.status(404).json({ message: 'Driver not found' });
driver.rewardPoints = (driver.rewardPoints || 0) + amount;
await driver.save();
return res.json({ message: 'Driver points updated', driverId: driver.id, rewardPoints: driver.rewardPoints });
} catch (e) { return res.status(500).json({ message: e.message }); }
};

// Award reward points to a passenger (admin-only)
exports.awardPassengerPoints = async (req, res) => {
try {
const { passengerId } = req.params;
const { points } = req.body;
const amount = Number(points);
if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ message: 'points must be a non-zero number' });
const passenger = await models.Passenger.findByPk(passengerId);
if (!passenger) return res.status(404).json({ message: 'Passenger not found' });
passenger.rewardPoints = (passenger.rewardPoints || 0) + amount;
await passenger.save();
return res.json({ message: 'Passenger points updated', passengerId: passenger.id, rewardPoints: passenger.rewardPoints });
} catch (e) { return res.status(500).json({ message: e.message }); }
};
