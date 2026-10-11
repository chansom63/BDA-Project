const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from central root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const clickhouseService = require('./services/clickhouseService');
const errorHandler = require('./middleware/errorHandler');

const flightRoutes = require('./routes/flights');
const alertRoutes = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// API Routes (queried directly from ClickHouse)
app.use('/api/flights', flightRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/anomalies', alertRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Flight Telemetry Backend API Service',
    database: 'ClickHouse OLAP DW',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static assets if built in production mode
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'API Server active. Client is running in Vite dev mode.' });
  }
});

// Global Error Handler
app.use(errorHandler);

// Initialize ClickHouse and start HTTP server
clickhouseService.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`
=============================================================
✈️  Flight Telemetry Backend REST API Running
📡 Server Port: http://localhost:${PORT}
💾 Primary OLAP Store: ClickHouse (http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'})
🎯 Endpoints:
   • GET /api/flights      - Latest position and telemetry for aircraft
   • GET /api/flights/:id  - Detailed single aircraft trajectory
   • GET /api/anomalies    - Recent anomaly alerts
   • GET /api/analytics/dashboard - Real-time aggregates
   • GET /api/health       - Healthcheck
=============================================================
      `);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to initialize ClickHouse connection:', err.message);
    process.exit(1);
  });
