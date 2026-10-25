-- =============================================================================
-- ClickHouse Schema Initialization
-- Real-Time Flight Telemetry Pipeline
--
-- Ingestion flow (approved architecture):
--   Kafka: processed-events  →  kafka_processed_events_queue
--                            →  (MV)  flight_telemetry        (MergeTree)
--                            →  (MV)  flight_aggregates        (MergeTree)
--   Kafka: anomalies         →  kafka_anomalies_queue
--                            →  (MV)  flight_anomalies         (MergeTree)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. MergeTree storage tables (queried by REST API and Grafana)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flight_telemetry (
    eventId          String,
    timestamp        DateTime,
    flightId         String,
    callsign         String,
    latitude         Float64 DEFAULT 0.0,
    longitude        Float64 DEFAULT 0.0,
    altitudeFt       Int32,
    speedKnots       Int32,
    headingDeg       Int32 DEFAULT 0,
    verticalRateFpm  Int32 DEFAULT 0,
    squawk           String,
    status           String,
    engineTemperature Int32 DEFAULT 700,
    route            String,
    origin           String,
    destination      String
) ENGINE = MergeTree()
ORDER BY (timestamp, flightId);

CREATE TABLE IF NOT EXISTS flight_anomalies (
    anomalyId        String,
    timestamp        DateTime,
    flightId         String,
    callsign         String,
    anomalyType      String,
    severity         String,
    details          String,
    altitudeFt       Int32,
    speedKnots       Int32,
    engineTemperature Int32,
    squawk           String
) ENGINE = MergeTree()
ORDER BY (timestamp, flightId);

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
ORDER BY windowStart;

-- ---------------------------------------------------------------------------
-- 2. Kafka Engine queue tables (consume from Kafka topics)
--    These are the entry points for Spark's output.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kafka_processed_events_queue (
    eventId          String,
    timestamp        String,
    flightId         String,
    callsign         String,
    latitude         Float64,
    longitude        Float64,
    altitudeFt       Int32,
    speedKnots       Int32,
    headingDeg       Int32,
    verticalRateFpm  Int32,
    squawk           String,
    status           String,
    engineTemperature Int32,
    route            String,
    origin           String,
    destination      String,
    -- Aggregate fields (present only in aggregate summary messages; NULL for telemetry rows)
    windowStart      Nullable(String),
    windowEnd        Nullable(String),
    totalFlights     Nullable(Int32),
    avgAltitude      Nullable(Float64),
    avgSpeed         Nullable(Float64),
    avgEngineTemp    Nullable(Float64),
    maxEngineTemp    Nullable(Int32),
    anomalyCount     Nullable(Int32)
) ENGINE = Kafka
SETTINGS
    kafka_broker_list  = 'kafka:29092',
    kafka_topic_list   = 'processed-events',
    kafka_group_name   = 'clickhouse-processed-consumer',
    kafka_format       = 'JSONEachRow',
    kafka_num_consumers = 1;

CREATE TABLE IF NOT EXISTS kafka_anomalies_queue (
    anomalyId        String,
    timestamp        String,
    flightId         String,
    callsign         String,
    anomalyType      String,
    severity         String,
    details          String,
    altitudeFt       Int32,
    speedKnots       Int32,
    engineTemperature Int32,
    squawk           String
) ENGINE = Kafka
SETTINGS
    kafka_broker_list  = 'kafka:29092',
    kafka_topic_list   = 'anomalies',
    kafka_group_name   = 'clickhouse-anomalies-consumer',
    kafka_format       = 'JSONEachRow',
    kafka_num_consumers = 1;

-- ---------------------------------------------------------------------------
-- 3. Materialized Views: pipe Kafka queue → MergeTree storage tables
-- ---------------------------------------------------------------------------

-- Telemetry: ingest rows that have a flightId (i.e. not aggregate summaries)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_processed_to_telemetry
TO flight_telemetry AS
SELECT
    eventId,
    parseDateTimeBestEffortOrNull(timestamp) AS timestamp,
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
WHERE flightId != '' AND flightId != 'UNK' AND (windowStart IS NULL OR windowStart = '');

-- Aggregates: ingest rows that carry the aggregate summary fields
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_processed_to_aggregates
TO flight_aggregates AS
SELECT
    parseDateTimeBestEffortOrNull(windowStart) AS windowStart,
    parseDateTimeBestEffortOrNull(windowEnd)   AS windowEnd,
    totalFlights,
    avgAltitude,
    avgSpeed,
    avgEngineTemp,
    maxEngineTemp,
    anomalyCount
FROM kafka_processed_events_queue
WHERE windowStart IS NOT NULL AND windowStart != '';

-- Anomalies: ingest from anomalies Kafka queue
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
FROM kafka_anomalies_queue;
