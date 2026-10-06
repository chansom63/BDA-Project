const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  flightId: { type: String, required: true, unique: true, index: true },
  icao24: { type: String, required: true, index: true },
  callsign: { type: String, required: true },
  airline: { type: String, required: true },
  aircraftType: { type: String, default: 'Boeing 787-9' },
  registration: { type: String, default: 'N104AN' },
  countryFlag: { type: String, default: '🇺🇸' },
  photoUrl: { type: String, default: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&auto=format&fit=crop&q=80' },
  std: { type: String, default: '12:00 UTC' },
  atd: { type: String, default: '12:10 UTC' },
  sta: { type: String, default: '20:00 UTC' },
  eta: { type: String, default: '19:50 UTC' },
  radarSource: { type: String, default: 'F-KJFK1' },
  origin: {
    code: { type: String, required: true },
    icao: { type: String },
    city: { type: String, required: true },
    country: { type: String, default: 'USA' },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true }
  },
  destination: {
    code: { type: String, required: true },
    icao: { type: String },
    city: { type: String, required: true },
    country: { type: String, default: 'UK' },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true }
  },
  currentPosition: {
    lat: { type: Number, required: true, index: true },
    lon: { type: Number, required: true, index: true },
    altitudeFt: { type: Number, required: true },
    speedKnots: { type: Number, required: true },
    headingDeg: { type: Number, required: true },
    verticalRateFpm: { type: Number, default: 0 }
  },
  squawk: { type: String, default: '1200' },
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
