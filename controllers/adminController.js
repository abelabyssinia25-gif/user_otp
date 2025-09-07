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

// Calculate reward points for a driver based on trip history from booking service
exports.calculateDriverRewardPoints = async (req, res) => {
try {
const { driverId } = req.params;
const driver = await models.Driver.findByPk(driverId);
if (!driver) return res.status(404).json({ message: 'Driver not found' });

// Call booking service to get trip history
const axios = require('axios');
const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:3001/api';

try {
  const response = await axios.get(`${bookingServiceUrl}/trips/history/driver/${driverId}`);
  const trips = response.data.trips || [];

  let totalPoints = 0;
  trips.forEach(trip => {
    // Base points per completed trip
    if (trip.status === 'completed') {
      totalPoints += 10;
      
      // Bonus points for high ratings
      if (trip.passengerRating >= 4.5) {
        totalPoints += 5;
      } else if (trip.passengerRating >= 4.0) {
        totalPoints += 3;
      } else if (trip.passengerRating >= 3.5) {
        totalPoints += 1;
      }
      
      // Distance bonus (1 point per km)
      if (trip.distance) {
        totalPoints += Math.floor(trip.distance);
      }
    }
  });

  // Update driver's reward points
  driver.rewardPoints = totalPoints;
  await driver.save();

  return res.json({ 
    message: 'Driver reward points calculated', 
    driverId: driver.id, 
    rewardPoints: driver.rewardPoints,
    completedTrips: trips.filter(trip => trip.status === 'completed').length,
    calculationDetails: {
      basePoints: trips.filter(trip => trip.status === 'completed').length * 10,
      ratingBonus: totalPoints - (trips.filter(trip => trip.status === 'completed').length * 10),
      totalTrips: trips.length
    }
  });
} catch (bookingError) {
  console.error('Error calling booking service:', bookingError.message);
  return res.status(500).json({ 
    message: 'Failed to fetch trip history from booking service',
    error: bookingError.message 
  });
}
} catch (e) { return res.status(500).json({ message: e.message }); }
};

// Calculate reward points for a passenger based on trip history from booking service
exports.calculatePassengerRewardPoints = async (req, res) => {
try {
const { passengerId } = req.params;
const passenger = await models.Passenger.findByPk(passengerId);
if (!passenger) return res.status(404).json({ message: 'Passenger not found' });

// Call booking service to get trip history
const axios = require('axios');
const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:3001/api';

try {
  const response = await axios.get(`${bookingServiceUrl}/trips/history/passenger/${passengerId}`);
  const trips = response.data.trips || [];

  let totalPoints = 0;
  const completedTrips = trips.filter(trip => trip.status === 'completed');
  
  completedTrips.forEach(trip => {
    // Base points per trip
    totalPoints += 5;
    
    // Bonus points for high ratings given to drivers
    if (trip.driverRating >= 4.5) {
      totalPoints += 3;
    } else if (trip.driverRating >= 4.0) {
      totalPoints += 2;
    } else if (trip.driverRating >= 3.5) {
      totalPoints += 1;
    }
  });
  
  // Loyalty bonus (extra points for frequent trips)
  if (completedTrips.length >= 10) {
    totalPoints += 10; // Loyalty bonus
  }

  // Update passenger's reward points
  passenger.rewardPoints = totalPoints;
  await passenger.save();

  return res.json({ 
    message: 'Passenger reward points calculated', 
    passengerId: passenger.id, 
    rewardPoints: passenger.rewardPoints,
    completedTrips: completedTrips.length,
    calculationDetails: {
      basePoints: completedTrips.length * 5,
      ratingBonus: totalPoints - (completedTrips.length * 5) - (completedTrips.length >= 10 ? 10 : 0),
      loyaltyBonus: completedTrips.length >= 10 ? 10 : 0,
      totalTrips: trips.length
    }
  });
} catch (bookingError) {
  console.error('Error calling booking service:', bookingError.message);
  return res.status(500).json({ 
    message: 'Failed to fetch trip history from booking service',
    error: bookingError.message 
  });
}
} catch (e) { return res.status(500).json({ message: e.message }); }
};
