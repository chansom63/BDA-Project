const express = require('express');
const router = express.Router();
const Flight = require('../models/Flight');
const adsbSimulator = require('../services/adsbSimulator');
const { verifyToken } = require('../middleware/auth');

// GET /api/flights - Query live flights with optional bbox, status, or search query
router.get('/', async (req, res, next) => {
  try {
    const { status, search, minLat, maxLat, minLon, maxLon } = req.query;
    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { flightId: regex },
        { callsign: regex },
        { airline: regex },
        { icao24: regex },
        { 'origin.code': regex },
        { 'destination.code': regex }
      ];
    }

    if (minLat && maxLat && minLon && maxLon) {
      filter['currentPosition.lat'] = { $gte: Number(minLat), $lte: Number(maxLat) };
      filter['currentPosition.lon'] = { $gte: Number(minLon), $lte: Number(maxLon) };
    }

    const flights = await Flight.find(filter).sort({ flightId: 1 });
    res.json({
      success: true,
      count: flights.length,
      flights
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/flights/:flightId - Fetch single flight details and trajectory history
router.get('/:flightId', async (req, res, next) => {
  try {
    const flight = await Flight.findOne({ flightId: req.params.flightId });
    if (!flight) {
      return res.status(404).json({ success: false, message: 'Flight not found' });
    }
    res.json({ success: true, flight });
  } catch (err) {
    next(err);
  }
});

// POST /api/flights/inject - Inject custom flight into simulator feed
router.post('/inject', verifyToken, async (req, res, next) => {
  try {
    const injected = adsbSimulator.injectCustomFlight(req.body);
    res.status(201).json({
      success: true,
      message: `Flight ${injected.flightId} successfully injected into live MSK/Kinesis telemetry stream`,
      flight: injected
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/flights/:flightId/squawk - Change squawk code or trigger emergency
router.post('/:flightId/squawk', verifyToken, async (req, res, next) => {
  try {
    const { squawkCode } = req.body;
    const updated = adsbSimulator.setSquawk(req.params.flightId, squawkCode);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Flight not found in simulator' });
    }
    res.json({
      success: true,
      message: `Squawk code for ${req.params.flightId} updated to ${squawkCode}`,
      flight: updated
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
