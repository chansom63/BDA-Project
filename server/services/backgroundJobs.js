const cron = require('node-cron');
const glueEtlEngine = require('./glueEtlEngine');
const Flight = require('../models/Flight');
const Alert = require('../models/Alert');
const AnalyticsSummary = require('../models/AnalyticsSummary');

class BackgroundJobsService {
  init() {
    console.log('⏰ Background Jobs engine (node-cron inside monolithic app) initialized');

    // Job 1: Run QuickSight Analytics Rollup every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
      try {
        console.log('🔄 [Cron Job] Running QuickSight analytical aggregation...');
        const activeFlights = await Flight.find({ status: { $ne: 'Landed' } });
        const emergencyCount = await Flight.countDocuments({ status: 'Emergency' });
        const alertCount = await Alert.countDocuments({ status: 'Active' });

        let totalSpeed = 0;
        let totalAlt = 0;
        activeFlights.forEach(f => {
          totalSpeed += (f.currentPosition.speedKnots || 0);
          totalAlt += (f.currentPosition.altitudeFt || 0);
        });

        const count = activeFlights.length || 1;

        await AnalyticsSummary.create({
          timestamp: new Date(),
          totalActiveFlights: activeFlights.length,
          totalEmergencyFlights: emergencyCount,
          avgSpeedKnots: Math.round(totalSpeed / count),
          avgAltitudeFt: Math.round(totalAlt / count),
          alertsTriggeredCount: alertCount,
          ingestedTelemetryRecordsCount: Math.floor(1000 + Math.random() * 500)
        });
      } catch (err) {
        console.error('Error in Analytics Rollup Job:', err.message);
      }
    });

    // Job 2: Run Hadoop MapReduce Batch Execution every 1 hour
    cron.schedule('0 * * * *', () => {
      try {
        console.log('🔄 [Cron Job] Triggering hourly Hadoop MapReduce Batch Job...');
        glueEtlEngine.runEtlJob();
      } catch (err) {
        console.error('Error in Hadoop MapReduce Cron Job:', err.message);
      }
    });
  }
}

module.exports = new BackgroundJobsService();
