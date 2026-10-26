const express = require('express');
const router = express.Router();
const openSkyService = require('../services/openSkyService');
const adsbSimulator = require('../services/adsbSimulator');

// GET /api/flights - Query latest flight positions directly from live feed & simulator
router.get('/', (req, res, next) => {
  try {
    const { status, search, minLat, maxLat, minLon, maxLon, limit } = req.query;
    let flights = openSkyService.getLatestFlights();

    if (status && status !== 'ALL') {
      flights = flights.filter(f => f.status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      flights = flights.filter(f =>
        (f.flightId && f.flightId.toLowerCase().includes(q)) ||
        (f.callsign && f.callsign.toLowerCase().includes(q)) ||
        (f.airline && f.airline.toLowerCase().includes(q)) ||
        (f.icao24 && f.icao24.toLowerCase().includes(q))
      );
    }

    if (minLat && maxLat && minLon && maxLon) {
      flights = flights.filter(f => {
        const lat = f.latitude ?? f.lat ?? 0;
        const lon = f.longitude ?? f.lon ?? 0;
        return lat >= Number(minLat) && lat <= Number(maxLat) &&
               lon >= Number(minLon) && lon <= Number(maxLon);
      });
    }

    if (limit) {
      flights = flights.slice(0, parseInt(limit, 10));
    }

    res.json({
      success: true,
      count: flights.length,
      timestamp: new Date().toISOString(),
      flights
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/flights/:flightId - Fetch single flight details and trajectory history
router.get('/:flightId', (req, res, next) => {
  try {
    const flights = openSkyService.getLatestFlights();
    const flight = flights.find(f =>
      (f.flightId && f.flightId.toLowerCase() === req.params.flightId.toLowerCase()) ||
      (f.icao24 && f.icao24.toLowerCase() === req.params.flightId.toLowerCase())
    );

    if (!flight) {
      return res.status(404).json({ success: false, message: 'Flight not found' });
    }
    res.json({ success: true, flight });
  } catch (err) {
    next(err);
  }
});

// POST /api/flights/inject - Inject custom flight into simulator feed
router.post('/inject', (req, res, next) => {
  try {
    const injected = adsbSimulator.injectCustomFlight(req.body);
    res.status(201).json({
      success: true,
      message: `Flight ${injected.flightId} successfully injected`,
      flight: injected
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/flights/:flightId/squawk - Change squawk code or trigger emergency
router.post('/:flightId/squawk', (req, res, next) => {
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
