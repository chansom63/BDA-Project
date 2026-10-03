const mongoose = require('mongoose');

const airspaceConfigSchema = new mongoose.Schema({
  configId: { type: String, default: 'default_config', unique: true },
  proximityAlertDistanceNM: { type: Number, default: 10.0 }, // Nautical Miles limit
  minAltitudeFt: { type: Number, default: 1000 },
  maxAltitudeFt: { type: Number, default: 45000 },
  simulationSpeedMultiplier: { type: Number, default: 1.0 }, // 1x, 2x, 5x, 10x
  autoNotificationEmail: { type: Boolean, default: true },
  autoNotificationSMS: { type: Boolean, default: true },
  s3RetentionDays: { type: Number, default: 90 },
  glueEtlSchedule: { type: String, default: 'Every 1 Hour' },
  kafkaIngestionRateEventsPerSec: { type: Number, default: 120 },
  weatherOverlayEnabled: { type: Boolean, default: true },
  emergencySquawksAutoAlert: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('AirspaceConfig', airspaceConfigSchema);
