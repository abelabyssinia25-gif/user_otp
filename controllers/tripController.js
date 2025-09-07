const { models } = require('../models');
const axios = require('axios');

// Create a new trip/booking request
exports.createTrip = async (req, res) => {
  try {
    if (req.user.type !== 'passenger') {
      return res.status(403).json({ message: 'Only passengers can create trip requests' });
    }

    const { driverId, pickupLocation, dropoffLocation, distance, fare } = req.body;

    // Validate required fields
    if (!driverId || !pickupLocation || !dropoffLocation || !fare) {
      return res.status(400).json({ 
        message: 'driverId, pickupLocation, dropoffLocation, and fare are required' 
      });
    }

    // Check if driver exists and is verified
    const driver = await models.Driver.findByPk(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Check if driver is verified/approved
    if (!driver.verification || driver.documentStatus !== 'approved') {
      return res.status(400).json({ 
        message: 'Driver must be verified and approved before accepting bookings' 
      });
    }

    // Call booking service to create the trip
    const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:3001/api';
    
    try {
      const response = await axios.post(`${bookingServiceUrl}/trips`, {
        passengerId: req.user.id,
        driverId,
        pickupLocation,
        dropoffLocation,
        distance: distance || null,
        fare,
        status: 'pending'
      });

      return res.status(201).json({
        message: 'Trip request created successfully',
        trip: response.data.trip
      });
    } catch (bookingError) {
      console.error('Error calling booking service:', bookingError.message);
      return res.status(500).json({ 
        message: 'Failed to create trip in booking service',
        error: bookingError.message 
      });
    }
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// Driver accepts a trip/booking
exports.acceptTrip = async (req, res) => {
  try {
    if (req.user.type !== 'driver') {
      return res.status(403).json({ message: 'Only drivers can accept trips' });
    }

    const { tripId } = req.params;

    // Check if driver is verified/approved
    const driver = await models.Driver.findByPk(req.user.id);
    if (!driver.verification || driver.documentStatus !== 'approved') {
      return res.status(400).json({ 
        message: 'Driver must be verified and approved before accepting bookings' 
      });
    }

    // Call booking service to accept the trip
    const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:3001/api';
    
    try {
      const response = await axios.post(`${bookingServiceUrl}/trips/${tripId}/accept`, {
        driverId: req.user.id
      });

      return res.json({
        message: 'Trip accepted successfully',
        trip: response.data.trip
      });
    } catch (bookingError) {
      console.error('Error calling booking service:', bookingError.message);
      return res.status(500).json({ 
        message: 'Failed to accept trip in booking service',
        error: bookingError.message 
      });
    }
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// Start trip
exports.startTrip = async (req, res) => {
  try {
    if (req.user.type !== 'driver') {
      return res.status(403).json({ message: 'Only drivers can start trips' });
    }

    const { tripId } = req.params;

    // Call booking service to start the trip
    const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:3001/api';
    
    try {
      const response = await axios.post(`${bookingServiceUrl}/trips/${tripId}/start`, {
        driverId: req.user.id
      });

      return res.json({
        message: 'Trip started successfully',
        trip: response.data.trip
      });
    } catch (bookingError) {
      console.error('Error calling booking service:', bookingError.message);
      return res.status(500).json({ 
        message: 'Failed to start trip in booking service',
        error: bookingError.message 
      });
    }
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// Complete trip
exports.completeTrip = async (req, res) => {
  try {
    if (req.user.type !== 'driver') {
      return res.status(403).json({ message: 'Only drivers can complete trips' });
    }

    const { tripId } = req.params;

    // Call booking service to complete the trip
    const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:3001/api';
    
    try {
      const response = await axios.post(`${bookingServiceUrl}/trips/${tripId}/complete`, {
        driverId: req.user.id
      });

      // Calculate and update reward points for both driver and passenger
      const trip = response.data.trip;
      await calculateRewardPoints(trip.driverId, trip.passengerId);

      return res.json({
        message: 'Trip completed successfully',
        trip: response.data.trip
      });
    } catch (bookingError) {
      console.error('Error calling booking service:', bookingError.message);
      return res.status(500).json({ 
        message: 'Failed to complete trip in booking service',
        error: bookingError.message 
      });
    }
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// Rate passenger after trip completion
exports.ratePassenger = async (req, res) => {
  try {
    if (req.user.type !== 'driver') {
      return res.status(403).json({ message: 'Only drivers can rate passengers' });
    }

    const { tripId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Call booking service to rate passenger
    const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:3001/api';
    
    try {
      const response = await axios.post(`${bookingServiceUrl}/trips/${tripId}/rate-passenger`, {
        driverId: req.user.id,
        rating,
        comment
      });

      // Update passenger's overall rating in user service
      const trip = response.data.trip;
      const passenger = await models.Passenger.findByPk(trip.passengerId);
      const currentRating = passenger.rating || 0;
      const ratingCount = passenger.ratingCount || 0;
      const newRatingCount = ratingCount + 1;
      const newRating = ((currentRating * ratingCount) + Number(rating)) / newRatingCount;

      await models.Passenger.update(
        { rating: newRating, ratingCount: newRatingCount }, 
        { where: { id: trip.passengerId } }
      );

      return res.json({
        message: 'Passenger rated successfully',
        trip: response.data.trip,
        passengerRating: newRating
      });
    } catch (bookingError) {
      console.error('Error calling booking service:', bookingError.message);
      return res.status(500).json({ 
        message: 'Failed to rate passenger in booking service',
        error: bookingError.message 
      });
    }
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// Rate driver after trip completion
exports.rateDriver = async (req, res) => {
  try {
    if (req.user.type !== 'passenger') {
      return res.status(403).json({ message: 'Only passengers can rate drivers' });
    }

    const { tripId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Call booking service to rate driver
    const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:3001/api';
    
    try {
      const response = await axios.post(`${bookingServiceUrl}/trips/${tripId}/rate-driver`, {
        passengerId: req.user.id,
        rating,
        comment
      });

      // Update driver's overall rating in user service
      const trip = response.data.trip;
      const driver = await models.Driver.findByPk(trip.driverId);
      const currentRating = driver.rating || 0;
      const ratingCount = driver.ratingCount || 0;
      const newRatingCount = ratingCount + 1;
      const newRating = ((currentRating * ratingCount) + Number(rating)) / newRatingCount;

      await models.Driver.update(
        { rating: newRating, ratingCount: newRatingCount }, 
        { where: { id: trip.driverId } }
      );

      return res.json({
        message: 'Driver rated successfully',
        trip: response.data.trip,
        driverRating: newRating
      });
    } catch (bookingError) {
      console.error('Error calling booking service:', bookingError.message);
      return res.status(500).json({ 
        message: 'Failed to rate driver in booking service',
        error: bookingError.message 
      });
    }
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// Helper function to calculate reward points
async function calculateRewardPoints(driverId, passengerId) {
  try {
    const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:3001/api';
    
    // Get driver trip history from booking service
    const driverResponse = await axios.get(`${bookingServiceUrl}/trips/history/driver/${driverId}`);
    const driverTrips = driverResponse.data.trips || [];

    let driverPoints = 0;
    driverTrips.forEach(trip => {
      if (trip.status === 'completed') {
        driverPoints += 10; // Base points
        if (trip.passengerRating >= 4.5) driverPoints += 5;
        else if (trip.passengerRating >= 4.0) driverPoints += 3;
        else if (trip.passengerRating >= 3.5) driverPoints += 1;
        if (trip.distance) driverPoints += Math.floor(trip.distance);
      }
    });

    // Get passenger trip history from booking service
    const passengerResponse = await axios.get(`${bookingServiceUrl}/trips/history/passenger/${passengerId}`);
    const passengerTrips = passengerResponse.data.trips || [];

    let passengerPoints = 0;
    const completedPassengerTrips = passengerTrips.filter(trip => trip.status === 'completed');
    completedPassengerTrips.forEach(trip => {
      passengerPoints += 5; // Base points
      if (trip.driverRating >= 4.5) passengerPoints += 3;
      else if (trip.driverRating >= 4.0) passengerPoints += 2;
      else if (trip.driverRating >= 3.5) passengerPoints += 1;
    });

    if (completedPassengerTrips.length >= 10) passengerPoints += 10; // Loyalty bonus

    // Update reward points
    await models.Driver.update({ rewardPoints: driverPoints }, { where: { id: driverId } });
    await models.Passenger.update({ rewardPoints: passengerPoints }, { where: { id: passengerId } });
  } catch (error) {
    console.error('Error calculating reward points:', error);
  }
}

// Get trip history for a user
exports.getTripHistory = async (req, res) => {
  try {
    const { userId, userType } = req.params;
    
    if (userType !== 'passenger' && userType !== 'driver') {
      return res.status(400).json({ message: 'Invalid user type. Use passenger or driver' });
    }

    // Call booking service to get trip history
    const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:3001/api';
    
    try {
      const response = await axios.get(`${bookingServiceUrl}/trips/history/${userType}/${userId}`);
      return res.json({ trips: response.data.trips || [] });
    } catch (bookingError) {
      console.error('Error calling booking service:', bookingError.message);
      return res.status(500).json({ 
        message: 'Failed to fetch trip history from booking service',
        error: bookingError.message 
      });
    }
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};
