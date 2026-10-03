const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  flightId: { type: String, required: true, unique: true, index: true }, // e.g. "AA104", "BA283"
  icao24: { type: String, required: true, index: true },               // e.g. "400A0C"
  callsign: { type: String, required: true },                           // e.g. "AAL104"
  airline: { type: String, required: true },                            // e.g. "American Airlines"
  aircraftType: { type: String, default: 'B787-9' },                   // e.g. "B787-9", "A350-900"
  origin: {
    code: { type: String, required: true },                            // e.g. "JFK"
    city: { type: String, required: true },                            // e.g. "New York"
    country: { type: String, default: 'USA' },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true }
  },
  destination: {
    code: { type: String, required: true },                            // e.g. "LHR"
    city: { type: String, required: true },                            // e.g. "London"
    country: { type: String, default: 'UK' },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true }
  },
  currentPosition: {
    lat: { type: Number, required: true, index: true },
    lon: { type: Number, required: true, index: true },
    altitudeFt: { type: Number, required: true },                       // Altitude in feet
    speedKnots: { type: Number, required: true },                       // Ground speed in knots
    headingDeg: { type: Number, required: true },                       // Heading 0-360 deg
    verticalRateFpm: { type: Number, default: 0 }                       // Vertical rate (climb/descent)
  },
  squawk: { type: String, default: '1200' },                             // 1200 VFR, 7700 General Emergency, 7600 Radio, 7500 Hijack
  status: {
    type: String,
    enum: ['Scheduled', 'Taxing', 'In-Flight', 'Approaching', 'Landed', 'Emergency', 'Diverted'],
    default: 'In-Flight'
  },
  progressPct: { type: Number, default: 0 },
  trajectory: [
    {
      lat: Number,
      lon: Number,
      altitudeFt: Number,
      speedKnots: Number,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  weatherTurbulence: {
    type: String,
    enum: ['None', 'Light', 'Moderate', 'Severe'],
    default: 'None'
  },
  lastTelemetryUpdate: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Flight', flightSchema);
