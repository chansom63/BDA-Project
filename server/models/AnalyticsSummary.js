const mongoose = require('mongoose');

const analyticsSummarySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  totalActiveFlights: { type: Number, default: 0 },
  totalEmergencyFlights: { type: Number, default: 0 },
  avgSpeedKnots: { type: Number, default: 0 },
  avgAltitudeFt: { type: Number, default: 0 },
  totalDistanceTraveledNM: { type: Number, default: 0 },
  ingestedTelemetryRecordsCount: { type: Number, default: 0 },
  s3ParquetFilesStored: { type: Number, default: 0 },
  redshiftRowsProcessed: { type: Number, default: 0 },
  alertsTriggeredCount: { type: Number, default: 0 },
  routeStats: [
    {
      routePair: String, // e.g. "JFK-LHR"
      activeCount: Number,
      avgSpeed: Number
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model('AnalyticsSummary', analyticsSummarySchema);
