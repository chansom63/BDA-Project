const express = require('express');
const router = express.Router();
const clickhouseService = require('../services/clickhouseService');

// GET /api/analytics/dashboard - Analytics dashboard data endpoint powered directly by ClickHouse
router.get('/dashboard', async (req, res, next) => {
  try {
    const report = await clickhouseService.getAnalyticsReport();

    res.json({
      success: true,
      realtimeMetrics: {
        activeFlights: report.dwData.activeFlights || 0,
        totalAlerts: report.dwData.totalAnomalies || 0,
        totalProcessedEvents: report.dwData.totalProcessedEvents || 0
      },
      analyticsData: report.dwData,
      status: {
        kafka: 'HEALTHY',
        sparkStreaming: 'ACTIVE',
        clickhouse: report.status,
        hdfs: 'ONLINE'
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
