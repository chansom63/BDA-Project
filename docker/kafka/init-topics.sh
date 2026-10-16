#!/usr/bin/env bash
set -e

BOOTSTRAP_SERVER=${KAFKA_BOOTSTRAP_SERVER:-"kafka:29092"}
echo "⏳ Waiting for Kafka broker at ${BOOTSTRAP_SERVER}..."

until kafka-topics --bootstrap-server "${BOOTSTRAP_SERVER}" --list > /dev/null 2>&1; do
  echo "Kafka not ready yet, sleeping 2s..."
  sleep 2
done

echo "✅ Kafka broker is reachable. Ensuring required topics exist..."

# Exactly three required topics per the approved architecture:
#   flight-telemetry  — raw events from generator
#   processed-events  — enriched telemetry from Spark
#   anomalies         — anomaly records from Spark
TOPICS=("flight-telemetry" "processed-events" "anomalies")

for TOPIC in "${TOPICS[@]}"; do
  echo "Checking / creating topic: ${TOPIC}"
  kafka-topics --bootstrap-server "${BOOTSTRAP_SERVER}" \
    --create \
    --if-not-exists \
    --topic "${TOPIC}" \
    --partitions 3 \
    --replication-factor 1
done

echo "✅ Topic initialization complete. Current topics on ${BOOTSTRAP_SERVER}:"
kafka-topics --bootstrap-server "${BOOTSTRAP_SERVER}" --list
