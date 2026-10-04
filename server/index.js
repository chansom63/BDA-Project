const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from central root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set global Mongoose buffer timeout BEFORE any models are loaded.
// This prevents operations buffered pre-connection (e.g. auth seeding)
// from timing out while the MongoDB Memory Server binary downloads on first run.
const mongoose = require('mongoose');
mongoose.set('bufferTimeoutMS', 300000); // 5 minutes

const { connectDB } = require('./config/db');
const streamProcessor = require('./services/streamProcessor');
const openSkyService = require('./services/openSkyService');  // Real-time ADS-B
const backgroundJobs = require('./services/backgroundJobs');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const flightRoutes = require('./routes/flights');
const alertRoutes = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');
const etlRoutes = require('./routes/etl');
const configRoutes = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/etl', etlRoutes);
app.use('/api/config', configRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Monolithic MERN Flight Telemetry Engine on AWS EC2',
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

// Create HTTP server & attach WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws/telemetry' });

wss.on('connection', (ws) => {
  console.log('📡 New WebSocket client connected for real-time telemetry');
  ws.send(JSON.stringify({
    type: 'SYSTEM_STATUS',
    message: 'Connected to AWS Flight Telemetry MSK/Kinesis WebSocket Stream',
    timestamp: new Date().toISOString()
  }));

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
  });
});

// Start DB connection, Services, and Server
connectDB()
  .then(() => {
    // Initialize stream processor with WebSocket server
    streamProcessor.init(wss);

    // Start OpenSky Network real-time ADS-B feed
    openSkyService.start();

    // Start Background Cron Jobs
    backgroundJobs.init();

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Kill the process using it and try again.`);
        console.error(`   Run: lsof -ti:${PORT} | xargs kill -9`);
      } else {
        console.error('❌ Server error:', err.message);
      }
      process.exit(1);
    });

    server.listen(PORT, () => {
      console.log(`
========================================================================
🚀 AWS MONOLITHIC MERN FLIGHT TELEMETRY SYSTEM IS ONLINE!
📡 Server running on: http://localhost:${PORT}
🔌 WebSocket endpoint: ws://localhost:${PORT}/ws/telemetry
========================================================================
      `);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  });
