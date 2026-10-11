const express = require('express');
const router = express.Router();
const clickhouseService = require('../services/clickhouseService');

// GET /api/flights - Query latest flight positions directly from ClickHouse
router.get('/', async (req, res, next) => {
  try {
    const { status, search, minLat, maxLat, minLon, maxLon, limit } = req.query;

    const flights = await clickhouseService.getLatestFlights({
      status,
      search,
      minLat,
      maxLat,
      minLon,
      maxLon,
      limit: limit || 500
    });

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

// GET /api/flights/:flightId - Fetch single flight details and trajectory history from ClickHouse
router.get('/:flightId', async (req, res, next) => {
  try {
    const flight = await clickhouseService.getFlightById(req.params.flightId);
    if (!flight) {
      return res.status(404).json({ success: false, message: 'Flight not found in ClickHouse' });
    }
    res.json({ success: true, flight });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
