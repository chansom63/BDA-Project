const express = require('express');
const router = express.Router();
const clickhouseService = require('../services/clickhouseService');

// GET /api/alerts or /api/anomalies - Fetch recent anomalies directly from ClickHouse
router.get('/', async (req, res, next) => {
  try {
    const limit = req.query.limit || 50;
    const anomalies = await clickhouseService.getRecentAnomalies(limit);

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
