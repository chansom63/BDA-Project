const { Kafka, Partitioners } = require('kafkajs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Load the existing flight simulator module
const adsbSimulator = require('./adsbSimulator');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:29092').split(',').map(b => b.trim());
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'flight-telemetry';
const INTERVAL_MS = parseInt(process.env.GENERATION_INTERVAL_MS || '15000', 10);
const CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'flight-telemetry-generator';

console.log(`====================================================`);
console.log(`✈️  Starting Standalone Flight Telemetry Generator`);
console.log(`📡 Target Kafka Brokers: ${KAFKA_BROKERS.join(', ')}`);
console.log(`📦 Kafka Topic: ${KAFKA_TOPIC}`);
console.log(`⏱️  Batch Interval: ${INTERVAL_MS} ms`);
console.log(`====================================================`);

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: KAFKA_BROKERS,
  retry: {
    initialRetryTime: 1000,
    retries: 30,
    factor: 1.5,
    maxRetryTime: 30000
  }
});

const producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner
});

let isConnected = false;
let batchCount = 0;

async function connectProducer() {
  let attempt = 0;
  while (!isConnected) {
    try {
      attempt++;
      console.log(`🔄 Attempting to connect Kafka Producer (attempt #${attempt})...`);
      await producer.connect();
      isConnected = true;
      console.log(`✅ Connected successfully to Kafka broker!`);
    } catch (err) {
      console.error(`❌ Connection failed: ${err.message}. Retrying in 3s...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
}

async function start() {
  await connectProducer();

  adsbSimulator.on('telemetry_batch', async (batch) => {
    if (!isConnected || !batch || batch.length === 0) return;

    try {
      const messages = batch.map(event => ({
        key: String(event.flightId || event.icao24),
        value: JSON.stringify(event)
      }));

      await producer.send({
        topic: KAFKA_TOPIC,
        messages
      });

      batchCount++;
      const emergencies = batch.filter(f => ['7700', '7600', '7500'].includes(f.squawk));
      console.log(`[Batch #${batchCount}] 📤 Produced ${messages.length} telemetry events to topic '${KAFKA_TOPIC}' (${emergencies.length} emergencies detected) at ${new Date().toISOString()}`);
    } catch (err) {
      console.error(`❌ Failed to send batch to Kafka:`, err.message);
    }
  });

  // Start internal simulation physics loop
  adsbSimulator.startSimulation(INTERVAL_MS);
}

// Graceful shutdown
async function shutdown() {
  console.log(`🛑 Stopping generator service...`);
  adsbSimulator.stopSimulation();
  try {
    await producer.disconnect();
    console.log(`🔌 Kafka producer disconnected cleanly.`);
  } catch (err) {
    console.error(`Error disconnecting producer:`, err.message);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch(err => {
  console.error(`Fatal generator error:`, err);
  process.exit(1);
});
