#!/bin/bash
# ============================================================================
# ClickHouse schema initializer — runs on EVERY container start.
# This ensures Kafka Engine tables and Materialized Views are always present
# even after the clickhouse_data volume has been initialized previously.
# ============================================================================
set -euo pipefail

CH_URL="http://clickhouse:8123"
CH_ARGS="user=ch_user&password=ch_password"

echo "⏳ Waiting for ClickHouse to be ready..."
until curl -sf "${CH_URL}/ping" > /dev/null 2>&1; do
  sleep 2
done
echo "✅ ClickHouse is ready."

run_sql() {
  local label="$1"
  local sql="$2"
  local result
  result=$(curl -sf "${CH_URL}/?${CH_ARGS}" --data-binary "${sql}" 2>&1)
  local rc=$?
  if [ $rc -eq 0 ]; then
    echo "✅ ${label}"
  else
    echo "⚠️  ${label}: ${result}"
  fi
}

# ── MergeTree storage tables ─────────────────────────────────────────────────
run_sql "flight_telemetry table" "
CREATE TABLE IF NOT EXISTS flight_telemetry (
    eventId           String,
    timestamp         DateTime,
    flightId          String,
    callsign          String,
    latitude          Float64 DEFAULT 0.0,
    longitude         Float64 DEFAULT 0.0,
    altitudeFt        Int32,
    speedKnots        Int32,
    headingDeg        Int32 DEFAULT 0,
    verticalRateFpm   Int32 DEFAULT 0,
    squawk            String,
    status            String,
    engineTemperature Int32 DEFAULT 700,
    route             String,
    origin            String,
    destination       String
) ENGINE = MergeTree()
ORDER BY (timestamp, flightId)
"

run_sql "flight_anomalies table" "
CREATE TABLE IF NOT EXISTS flight_anomalies (
    anomalyId         String,
    timestamp         DateTime,
    flightId          String,
    callsign          String,
    anomalyType       String,
    severity          String,
    details           String,
    altitudeFt        Int32,
    speedKnots        Int32,
    engineTemperature Int32,
    squawk            String
) ENGINE = MergeTree()
ORDER BY (timestamp, flightId)
"

run_sql "flight_aggregates table" "
CREATE TABLE IF NOT EXISTS flight_aggregates (
    windowStart      DateTime,
    windowEnd        DateTime,
    totalFlights     Int32,
    avgAltitude      Float64,
    avgSpeed         Float64,
    avgEngineTemp    Float64,
    maxEngineTemp    Int32,
    anomalyCount     Int32
) ENGINE = MergeTree()
ORDER BY windowStart
"

# ── Kafka Engine queue tables ────────────────────────────────────────────────
run_sql "kafka_processed_events_queue" "
CREATE TABLE IF NOT EXISTS kafka_processed_events_queue (
    eventId           String,
    timestamp         String,
    flightId          String,
    callsign          String,
    latitude          Float64,
    longitude         Float64,
    altitudeFt        Int32,
    speedKnots        Int32,
    headingDeg        Int32,
    verticalRateFpm   Int32,
    squawk            String,
    status            String,
    engineTemperature Int32,
    route             String,
    origin            String,
    destination       String,
    windowStart       Nullable(String),
    windowEnd         Nullable(String),
    totalFlights      Nullable(Int32),
    avgAltitude       Nullable(Float64),
    avgSpeed          Nullable(Float64),
    avgEngineTemp     Nullable(Float64),
    maxEngineTemp     Nullable(Int32),
    anomalyCount      Nullable(Int32)
) ENGINE = Kafka
SETTINGS
    kafka_broker_list   = 'kafka:29092',
    kafka_topic_list    = 'processed-events',
    kafka_group_name    = 'clickhouse-processed-consumer',
    kafka_format        = 'JSONEachRow',
    kafka_num_consumers = 1
"

run_sql "kafka_anomalies_queue" "
CREATE TABLE IF NOT EXISTS kafka_anomalies_queue (
    anomalyId         String,
    timestamp         String,
    flightId          String,
    callsign          String,
    anomalyType       String,
    severity          String,
    details           String,
    altitudeFt        Int32,
    speedKnots        Int32,
    engineTemperature Int32,
    squawk            String
) ENGINE = Kafka
SETTINGS
    kafka_broker_list   = 'kafka:29092',
    kafka_topic_list    = 'anomalies',
    kafka_group_name    = 'clickhouse-anomalies-consumer',
    kafka_format        = 'JSONEachRow',
    kafka_num_consumers = 1
"

# ── Materialized Views ───────────────────────────────────────────────────────
run_sql "mv_processed_to_telemetry" "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_processed_to_telemetry
TO flight_telemetry AS
SELECT
    eventId,
    parseDateTimeBestEffort(timestamp) AS timestamp,
    flightId,
    callsign,
    latitude,
    longitude,
    altitudeFt,
    speedKnots,
    headingDeg,
    verticalRateFpm,
    squawk,
    status,
    engineTemperature,
    route,
    origin,
    destination
FROM kafka_processed_events_queue
WHERE flightId != '' AND flightId != 'UNK' AND windowStart IS NULL
"

run_sql "mv_processed_to_aggregates" "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_processed_to_aggregates
TO flight_aggregates AS
SELECT
    parseDateTimeBestEffort(windowStart) AS windowStart,
    parseDateTimeBestEffort(windowEnd)   AS windowEnd,
    totalFlights,
    avgAltitude,
    avgSpeed,
    avgEngineTemp,
    maxEngineTemp,
    anomalyCount
FROM kafka_processed_events_queue
WHERE windowStart IS NOT NULL
"

run_sql "mv_anomalies_to_storage" "
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_anomalies_to_storage
TO flight_anomalies AS
SELECT
    anomalyId,
    parseDateTimeBestEffort(timestamp) AS timestamp,
    flightId,
    callsign,
    anomalyType,
    severity,
    details,
    altitudeFt,
    speedKnots,
    engineTemperature,
    squawk
FROM kafka_anomalies_queue
"

echo ""
echo "✅ ClickHouse schema initialization complete."
echo "   Tables: flight_telemetry, flight_anomalies, flight_aggregates"
echo "   Kafka Engine: kafka_processed_events_queue, kafka_anomalies_queue"
echo "   MVs: mv_processed_to_telemetry, mv_processed_to_aggregates, mv_anomalies_to_storage"
