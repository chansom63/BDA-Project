const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Increase global buffer timeout so operations queued before the DB connects
// (e.g. seedDefaultUsers in auth.js) don't time out during the MongoDB
// Memory Server first-run binary download (~82MB).
mongoose.set('bufferTimeoutMS', 300000); // 5 minutes

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
    console.log('📥 First run: may need to download the MongoDB binary (~82MB). Please wait...');
    try {
      mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      // Use a high bufferTimeoutMS so Mongoose operations don't time out
      // while the MongoDB binary is being downloaded on first launch
      await mongoose.connect(uri, {
        bufferTimeoutMS: 300000, // 5 minutes — survives first-run binary download
        serverSelectionTimeoutMS: 300000
      });
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
