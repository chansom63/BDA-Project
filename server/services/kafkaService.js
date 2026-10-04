const { Kafka } = require('kafkajs');

class KafkaService {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'flight-telemetry-app',
      brokers: ['localhost:9093']
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
        topic: 'raw-adsb-telemetry-feed',
        messages,
      });
      console.log(`📤 Produced batch of ${messages.length} messages to Kafka`);
    } catch (error) {
      console.error('❌ Kafka Producer Error:', error.message);
    }
  }

  async consumeTelemetryStream(onBatchReceived) {
    try {
      await this.consumer.connect();
      console.log('✅ Connected to Real Kafka Consumer');
      await this.consumer.subscribe({ topic: 'raw-adsb-telemetry-feed', fromBeginning: false });

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
