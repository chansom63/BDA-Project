const express = require('express');
const router = express.Router();
const openSkyService = require('../services/openSkyService');

// GET /api/alerts or /api/anomalies - Fetch recent anomalies
router.get('/', (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const flights = openSkyService.getLatestFlights();

    const anomalies = flights
      .filter(f => ['7700', '7600', '7500'].includes(f.squawk) || f.status === 'Emergency' || (f.engineTemperature && f.engineTemperature > 900))
      .map((f, idx) => ({
        anomalyId: `alert_${f.flightId || idx}`,
        timestamp: f.timestamp || new Date().toISOString(),
        flightId: f.flightId,
        callsign: f.callsign,
        anomalyType: f.squawk === '7700' ? 'MAYDAY Emergency Squawk' :
                     f.squawk === '7600' ? 'Radio Failure' :
                     f.squawk === '7500' ? 'Unlawful Interference' :
                     f.engineTemperature > 900 ? 'High Engine Temp' : 'Emergency State',
        severity: 'EMERGENCY',
        details: `Squawk ${f.squawk} detected at FL${Math.round((f.altitudeFt || 35000) / 100)}. Engine Temp: ${f.engineTemperature || 750}°C`,
        altitudeFt: f.altitudeFt,
        speedKnots: f.speedKnots,
        engineTemperature: f.engineTemperature || 750,
        squawk: f.squawk,
        status: 'Active'
      }))
      .slice(0, limit);

    res.json({
      success: true,
      count: anomalies.length,
      alerts: anomalies,
      anomalies
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
