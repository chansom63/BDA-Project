-- =============================================================================
-- ClickHouse Schema Initialization: Complete Airline Analytics & Telemetry Platform
-- =============================================================================

-- 1. DETAILED FLIGHT TELEMETRY (Continuous Streams & Historical Backfills)
CREATE TABLE IF NOT EXISTS flight_telemetry (
    eventId              String,
    timestamp            DateTime,
    flightId             String,
    callsign             String,
    airline              String DEFAULT 'American Airlines',
    aircraftType         String DEFAULT 'Boeing 737-800',
    aircraftRegistration String DEFAULT 'AAL-1000',
    latitude             Float64 DEFAULT 0.0,
    longitude            Float64 DEFAULT 0.0,
    altitudeFt           Int32,
    speedKnots           Int32,
    headingDeg           Int32 DEFAULT 0,
    verticalRateFpm      Int32 DEFAULT 0,
    squawk               String DEFAULT '1200',
    flightPhase          String DEFAULT 'CRUISE',
    engineTemperature    Int32 DEFAULT 700,
    fuelFlowKgh          Float64 DEFAULT 2200.0,
    vibrationMmS         Float64 DEFAULT 1.1,
    co2EmissionRateKgs   Float64 DEFAULT 1.93,
    sensorQuality        Float64 DEFAULT 0.98,
    anomalyLabel         String DEFAULT 'NORMAL',
    route                String,
    origin               String,
    destination          String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (airline, flightId, timestamp);

-- 2. FLIGHT SCHEDULES & OPERATIONAL OUTCOMES
CREATE TABLE IF NOT EXISTS flight_schedules (
    flightId               String,
    callsign               String,
    airline                String,
    origin                 String,
    destination            String,
    scheduledDeparture     DateTime,
    actualDeparture        DateTime,
    scheduledArrival       DateTime,
    actualArrival          DateTime,
    status                 String,
    routeDistanceKm        Float64,
    aircraftType           String,
    aircraftRegistration   String,
    departureDelayMinutes  Int32,
    arrivalDelayMinutes    Int32,
    weatherCondition       String,
    cancellationReason     String
) ENGINE = ReplacingMergeTree()
ORDER BY (airline, origin, destination, scheduledDeparture, flightId);

-- 3. PASSENGER BOOKING & CABIN LOAD FACTORS
CREATE TABLE IF NOT EXISTS flight_bookings (
    bookingId            String,
    flightId             String,
    cabinClass           String,
    bookedSeats          Int32,
    checkInCount         Int32,
    boardedCount         Int32,
    noShowCount          Int32,
    cancelledCount       Int32,
    ticketRevenueUsd     Float64,
    ancillaryRevenueUsd  Float64,
    bookingTimestamp     DateTime
) ENGINE = MergeTree()
ORDER BY (flightId, bookingId);

-- 4. FINANCIAL TRANSACTIONS & OPERATING COSTS
CREATE TABLE IF NOT EXISTS flight_financials (
    transactionId        String,
    flightId             String,
    airline              String,
    route                String,
    timestamp            DateTime,
    ticketRevenue        Float64,
    ancillaryRevenue     Float64,
    cargoRevenue         Float64,
    fuelCost             Float64,
    airportFees          Float64,
    navigationCharges    Float64,
    crewCost             Float64,
    maintenanceCost      Float64,
    totalRevenue         Float64,
    totalOperatingCost   Float64,
    operatingProfit      Float64,
    operatingMarginPct   Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (airline, route, timestamp, flightId);

-- 5. WEATHER OBSERVATIONS
CREATE TABLE IF NOT EXISTS weather_observations (
    observationId        String,
    airportCode          String,
    timestamp            DateTime,
    temperatureC         Float64,
    windSpeedKts         Float64,
    windDirectionDeg     Int32,
    visibilityKm         Float64,
    precipitationMm      Float64,
    conditionCategory    String,
    weatherDelayRisk     String
) ENGINE = MergeTree()
ORDER BY (airportCode, timestamp);

-- 6. FLEET ASSET HEALTH & MAINTENANCE
CREATE TABLE IF NOT EXISTS fleet_maintenance (
    maintenanceId            String,
    aircraftRegistration     String,
    aircraftType             String,
    airline                  String,
    timestamp                DateTime,
    flightHoursTotal         Float64,
    flightCyclesTotal        Int32,
    engineVibrationAvg       Float64,
    lastMaintenanceDate      Date,
    nextScheduledCheck       String,
    componentStatus          String,
    maintenanceDowntimeHours Float64,
    maintenanceCostUsd       Float64,
    failureRiskScore         Float64
) ENGINE = MergeTree()
ORDER BY (aircraftRegistration, timestamp);

-- 7. ANOMALY DETECTIONS
CREATE TABLE IF NOT EXISTS flight_anomalies (
    anomalyId            String,
    timestamp            DateTime,
    flightId             String,
    callsign             String,
    anomalyType          String,
    severity             String,
    details              String,
    altitudeFt           Int32,
    speedKnots           Int32,
    engineTemperature    Int32,
    squawk               String
) ENGINE = MergeTree()
ORDER BY (timestamp, flightId);

-- 8. REAL-TIME STREAMING AGGREGATES
CREATE TABLE IF NOT EXISTS flight_aggregates (
    windowStart          DateTime,
    windowEnd            DateTime,
    totalFlights         Int32,
    avgAltitude          Float64,
    avgSpeed             Float64,
    avgEngineTemp        Float64,
    maxEngineTemp        Int32,
    anomalyCount         Int32
) ENGINE = MergeTree()
ORDER BY windowStart;

-- ---------------------------------------------------------------------------
-- 9. KAFKA QUEUE TABLES FOR STREAMING INGESTION
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kafka_processed_events_queue (
    eventId              String,
    timestamp            String,
    flightId             String,
    callsign             String,
    airline              Nullable(String),
    aircraftType         Nullable(String),
    aircraftRegistration Nullable(String),
    latitude             Float64,
    longitude            Float64,
    altitudeFt           Int32,
    speedKnots           Int32,
    headingDeg           Int32,
    verticalRateFpm      Int32,
    squawk               String,
    flightPhase          Nullable(String),
    status               String,
    engineTemperature    Int32,
    fuelFlowKgh          Nullable(Float64),
    vibrationMmS         Nullable(Float64),
    co2EmissionRateKgs   Nullable(Float64),
    sensorQuality        Nullable(Float64),
    anomalyLabel         Nullable(String),
    route                String,
    origin               String,
    destination          String,
    windowStart          Nullable(String),
    windowEnd            Nullable(String),
    totalFlights         Nullable(Int32),
    avgAltitude          Nullable(Float64),
    avgSpeed             Nullable(Float64),
    avgEngineTemp        Nullable(Float64),
    maxEngineTemp        Nullable(Int32),
    anomalyCount         Nullable(Int32)
) ENGINE = Kafka
SETTINGS
    kafka_broker_list   = 'kafka:29092',
    kafka_topic_list    = 'processed-events',
    kafka_group_name    = 'clickhouse-processed-consumer',
    kafka_format        = 'JSONEachRow',
    kafka_num_consumers = 2;

CREATE TABLE IF NOT EXISTS kafka_anomalies_queue (
    anomalyId            String,
    timestamp            String,
    flightId             String,
    callsign             String,
    anomalyType          String,
    severity             String,
    details              String,
    altitudeFt           Int32,
    speedKnots           Int32,
    engineTemperature    Int32,
    squawk               String
) ENGINE = Kafka
SETTINGS
    kafka_broker_list   = 'kafka:29092',
    kafka_topic_list    = 'anomalies',
    kafka_group_name    = 'clickhouse-anomalies-consumer',
    kafka_format        = 'JSONEachRow',
    kafka_num_consumers = 1;

-- ---------------------------------------------------------------------------
-- 10. MATERIALIZED VIEWS (Kafka Queues → MergeTree Storage)
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_processed_to_telemetry
TO flight_telemetry AS
SELECT
    eventId,
    parseDateTimeBestEffort(timestamp) AS timestamp,
    flightId,
    callsign,
    ifNull(airline, 'American Airlines') AS airline,
    ifNull(aircraftType, 'Boeing 737-800') AS aircraftType,
    ifNull(aircraftRegistration, 'AAL-1000') AS aircraftRegistration,
    latitude,
    longitude,
    altitudeFt,
    speedKnots,
    headingDeg,
    verticalRateFpm,
    squawk,
    ifNull(flightPhase, 'CRUISE') AS flightPhase,
    engineTemperature,
    ifNull(fuelFlowKgh, 2200.0) AS fuelFlowKgh,
    ifNull(vibrationMmS, 1.1) AS vibrationMmS,
    ifNull(co2EmissionRateKgs, 1.93) AS co2EmissionRateKgs,
    ifNull(sensorQuality, 0.98) AS sensorQuality,
    ifNull(anomalyLabel, 'NORMAL') AS anomalyLabel,
    route,
    origin,
    destination
FROM kafka_processed_events_queue
WHERE flightId != '' AND flightId != 'UNK' AND windowStart IS NULL;

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
WHERE windowStart IS NOT NULL;

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
