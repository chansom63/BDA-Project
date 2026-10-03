const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod = null;

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flight_telemetry';
    
    // Set connection timeout short to fallback quickly if local mongo isn't active
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`✅ MongoDB Connected to: ${mongoose.connection.host}`);
  } catch (err) {
    console.log('⚠️ Local MongoDB not reachable. Starting In-Memory MongoDB Server for seamless execution...');
    try {
      mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log(`✅ MongoDB Memory Server Connected at: ${uri}`);
    } catch (memErr) {
      console.error('❌ MongoDB Connection Error:', memErr.message);
    }
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
};

module.exports = { connectDB, disconnectDB };
