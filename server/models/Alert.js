const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['ProximityBreach', 'EmergencySquawk', 'RouteDeviation', 'AltitudeViolation', 'TurbulenceAlert', 'SystemNotice'],
    required: true
  },
  severity: {
    type: String,
    enum: ['INFO', 'WARNING', 'CRITICAL', 'EMERGENCY'],
    default: 'WARNING'
  },
  flightId: { type: String, required: true, index: true },
  callsign: { type: String, required: true },
  secondaryFlightId: { type: String, default: null }, // for proximity alerts involving two aircraft
  secondaryCallsign: { type: String, default: null },
  distanceNM: { type: Number, default: null },
  squawkCode: { type: String, default: null },
  message: { type: String, required: true },
  location: {
    lat: Number,
    lon: Number,
    altitudeFt: Number
  },
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: { type: String, default: null },
  acknowledgedAt: { type: Date, default: null },
  status: { type: String, enum: ['Active', 'Resolved', 'Dismissed'], default: 'Active' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Alert', alertSchema);
