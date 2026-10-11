const { Kafka } = require('kafkajs');

class KafkaService {
  constructor() {
    const brokers = process.env.KAFKA_BROKERS
      ? process.env.KAFKA_BROKERS.split(',').map(b => b.trim())
      : ['localhost:9093'];
    this.rawTopic = process.env.KAFKA_RAW_TOPIC || 'flight-telemetry';
    this.processedTopic = process.env.KAFKA_PROCESSED_TOPIC || 'processed-events';
    this.anomaliesTopic = process.env.KAFKA_ANOMALIES_TOPIC || 'anomalies';

    this.kafka = new Kafka({
      clientId: 'flight-telemetry-app',
      brokers
    });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'flight-stream-processor-group' });
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;
    try {
      await this.producer.connect();
      console.log('✅ Connected to Real Kafka Producer');
      this.isConnected = true;
    } catch (error) {
      console.error('❌ Kafka Connection Error:', error.message);
    }
  }

  async produceTelemetryBatch(batch) {
    if (!this.isConnected) return;
    try {
      const messages = batch.map(evt => ({
        key: evt.flightId,
        value: JSON.stringify(evt)
      }));

      await this.producer.send({
        topic: this.rawTopic,
        messages,
      });
      console.log(`📤 Produced batch of ${messages.length} messages to Kafka (${this.rawTopic})`);
    } catch (error) {
      console.error('❌ Kafka Producer Error:', error.message);
    }
  }

  async consumeTelemetryStream(onBatchReceived) {
    try {
      await this.consumer.connect();
      console.log('✅ Connected to Real Kafka Consumer');
      await this.consumer.subscribe({ topic: this.rawTopic, fromBeginning: false });

      await this.consumer.run({
        eachBatchAutoResolve: true,
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
          const telemetryEvents = [];
          for (let message of batch.messages) {
            telemetryEvents.push(JSON.parse(message.value.toString()));
            resolveOffset(message.offset);
          }
          if (telemetryEvents.length > 0) {
            console.log(`📥 Consumed batch of ${telemetryEvents.length} messages from Kafka`);
            await onBatchReceived(telemetryEvents);
          }
          await heartbeat();
        },
      });
    } catch (error) {
      console.error('❌ Kafka Consumer Error:', error.message);
    }
  }
}

module.exports = new KafkaService();
