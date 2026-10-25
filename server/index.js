/**
 * Flight Telemetry REST API
 * Approved architecture: ClickHouse → REST API → React Web UI
 *
 * Endpoints:
 *   GET /api/health               – liveness check
 *   GET /api/flights              – latest flight positions (from ClickHouse)
 *   GET /api/flights/:flightId    – single flight detail & trajectory
 *   GET /api/anomalies            – recent anomaly alerts
 *   GET /api/analytics/dashboard  – aggregate statistics
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const clickhouseService = require('./services/clickhouseService');

const flightRoutes    = require('./routes/flights');
const alertRoutes     = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ── REST API routes (all backed by ClickHouse) ──────────────────────────────
app.use('/api/flights',   flightRoutes);
app.use('/api/alerts',    alertRoutes);
app.use('/api/anomalies', alertRoutes);
app.use('/api/analytics', analyticsRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status:    'HEALTHY',
    service:   'Flight Telemetry REST API',
    database:  'ClickHouse',
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

// ── Start ─────────────────────────────────────────────────────────────────────
clickhouseService.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`
=============================================================
✈️  Flight Telemetry REST API
📡 Port : http://0.0.0.0:${PORT}
💾 Store: ClickHouse (${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'})
🎯 Endpoints:
   GET /api/flights              – latest aircraft positions
   GET /api/flights/:id          – single flight trajectory
   GET /api/anomalies            – recent anomaly alerts
   GET /api/analytics/dashboard  – real-time aggregates
   GET /api/health               – liveness check
=============================================================`
      );
    });
  })
  .catch(err => {
    console.error('❌ ClickHouse connection failed:', err.message);
    process.exit(1);
  });
