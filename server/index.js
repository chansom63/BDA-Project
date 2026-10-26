/**
 * Flight Telemetry REST API
 * Architecture: OpenSky Network API + ADS-B Simulator Engine → REST API → React Web UI
 *
 * Endpoints:
 *   GET /api/health               – liveness check
 *   GET /api/flights              – latest flight positions
 *   GET /api/flights/:flightId    – single flight detail & trajectory
 *   GET /api/anomalies            – recent anomaly alerts
 *   GET /api/analytics/dashboard  – aggregate statistics
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const openSkyService = require('./services/openSkyService');

const flightRoutes    = require('./routes/flights');
const alertRoutes     = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ── REST API routes ──────────────────────────────────────────────────────────
app.use('/api/flights',   flightRoutes);
app.use('/api/alerts',    alertRoutes);
app.use('/api/anomalies', alertRoutes);
app.use('/api/analytics', analyticsRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status:    'HEALTHY',
    service:   'Flight Telemetry REST API',
    engine:    'OpenSky Live Feed + ADS-B Simulator',
    timestamp: new Date().toISOString()
  });
});

// ── Serve pre-built React client (when running inside the backend container) ──
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const index = path.join(clientBuildPath, 'index.html');
  if (require('fs').existsSync(index)) {
    res.sendFile(index);
  } else {
    res.json({ message: 'API server running. Frontend served by dedicated container.' });
  }
});

// ── Start OpenSky Live Feed & ADS-B Simulator ────────────────────────────────
openSkyService.start();

// ── Start HTTP Server ────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
=============================================================
✈️  Flight Telemetry REST API Running
📡 Port : http://0.0.0.0:${PORT}
🚀 Engine: OpenSky Network API + ADS-B Flight Simulator
🎯 Endpoints:
   GET /api/flights              – latest aircraft positions
   GET /api/flights/:id          – single flight trajectory
   GET /api/anomalies            – recent anomaly alerts
   GET /api/analytics/dashboard  – real-time aggregates
   GET /api/health               – liveness check
=============================================================`
  );
});
