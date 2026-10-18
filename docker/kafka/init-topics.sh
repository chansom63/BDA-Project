#!/usr/bin/env bash
set -e

BOOTSTRAP_SERVER=${KAFKA_BOOTSTRAP_SERVER:-"kafka:29092"}
echo "⏳ Waiting for Kafka broker at ${BOOTSTRAP_SERVER}..."

until kafka-topics --bootstrap-server "${BOOTSTRAP_SERVER}" --list > /dev/null 2>&1; do
  echo "Kafka not ready yet, sleeping 2s..."
  sleep 2
done

echo "✅ Kafka broker is reachable. Ensuring required topics exist..."

# Required Kafka topics across streaming pipeline
declare -A TOPIC_PARTITIONS=(
  ["flight-telemetry"]=6
  ["flight-events"]=3
  ["bookings"]=3
  ["financial-events"]=3
  ["weather-events"]=3
  ["maintenance-events"]=3
  ["processed-events"]=6
  ["anomalies"]=3
)

for TOPIC in "${!TOPIC_PARTITIONS[@]}"; do
  PARTITIONS=${TOPIC_PARTITIONS[$TOPIC]}
  echo "Checking / creating topic: ${TOPIC} (partitions: ${PARTITIONS})"
  kafka-topics --bootstrap-server "${BOOTSTRAP_SERVER}" \
    --create \
    --if-not-exists \
    --topic "${TOPIC}" \
    --partitions "${PARTITIONS}" \
    --replication-factor 1 \
    --config compression.type=lz4 \
    --config retention.ms=86400000
done

echo "✅ Topic initialization complete. Current topics on ${BOOTSTRAP_SERVER}:"
kafka-topics --bootstrap-server "${BOOTSTRAP_SERVER}" --list
