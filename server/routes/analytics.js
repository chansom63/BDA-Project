const express = require('express');
const router = express.Router();
const clickhouseService = require('../services/clickhouseService');
const s3DataLake = require('../services/s3DataLake');
const AnalyticsSummary = require('../models/AnalyticsSummary');
const Flight = require('../models/Flight');
const Alert = require('../models/Alert');

// GET /api/analytics/dashboard - QuickSight BI dashboard data endpoint
router.get('/dashboard', async (req, res, next) => {
  try {
    const clickhouseReport = await clickhouseService.getAnalyticsReport();
    const s3Metrics = s3DataLake.getMetrics();

    const activeFlightsCount = await Flight.countDocuments({ status: { $ne: 'Landed' } });
    const emergencyCount = await Flight.countDocuments({ status: 'Emergency' });
    const totalAlertsCount = await Alert.countDocuments();
    const activeAlertsCount = await Alert.countDocuments({ status: 'Active' });

    const recentSummaries = await AnalyticsSummary.find().sort({ timestamp: -1 }).limit(24);

    res.json({
      success: true,
      realtimeMetrics: {
        activeFlights: activeFlightsCount,
        emergencyFlights: emergencyCount,
        totalAlerts: totalAlertsCount,
        activeAlerts: activeAlertsCount,
        s3ParquetStoredMB: s3Metrics.totalSizeMB,
        s3ObjectsCount: s3Metrics.totalObjectsCount,
        redshiftProcessedEvents: clickhouseReport.dwData.totalProcessedEvents
      },
      redshiftData: clickhouseReport.dwData,
      recentSummaries,
      awsPipelineStatus: {
        mskKafka: 'HEALTHY',
        kinesisAnalytics: 'ACTIVE',
        documentDb: 'AVAILABLE',
        s3DataLake: 'ONLINE',
        glueEtl: 'READY',
        redshiftDw: 'AVAILABLE',
        quicksight: 'CONNECTED'
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
