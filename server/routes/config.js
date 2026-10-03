const express = require('express');
const router = express.Router();
const AirspaceConfig = require('../models/AirspaceConfig');
const adsbSimulator = require('../services/adsbSimulator');
const { verifyToken, checkRole } = require('../middleware/auth');

// GET /api/config - Get current airspace and system threshold config
router.get('/', async (req, res, next) => {
  try {
    let config = await AirspaceConfig.findOne({ configId: 'default_config' });
    if (!config) {
      config = await AirspaceConfig.create({ configId: 'default_config' });
    }
    res.json({
      success: true,
      config,
      simulatorState: {
        isRunning: adsbSimulator.isRunning,
        speedMultiplier: adsbSimulator.speedMultiplier,
        activeFlightCount: adsbSimulator.flights.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/config - Update thresholds & settings (Admin/Analyst)
router.put('/', verifyToken, checkRole(['Admin', 'Analyst']), async (req, res, next) => {
  try {
    const {
      proximityAlertDistanceNM,
      simulationSpeedMultiplier,
      autoNotificationEmail,
      autoNotificationSMS,
      weatherOverlayEnabled
    } = req.body;

    const config = await AirspaceConfig.findOneAndUpdate(
      { configId: 'default_config' },
      {
        $set: {
          proximityAlertDistanceNM,
          simulationSpeedMultiplier,
          autoNotificationEmail,
          autoNotificationSMS,
          weatherOverlayEnabled
        }
      },
      { new: true, upsert: true }
    );

    if (simulationSpeedMultiplier !== undefined) {
      adsbSimulator.setSpeedMultiplier(simulationSpeedMultiplier);
    }

    res.json({
      success: true,
      message: 'Airspace telemetry configurations updated successfully',
      config
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
