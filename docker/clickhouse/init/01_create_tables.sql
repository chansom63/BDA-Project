CREATE TABLE IF NOT EXISTS flight_telemetry (
    eventId String,
    timestamp DateTime,
    flightId String,
    callsign String,
    latitude Float64 DEFAULT 0.0,
    longitude Float64 DEFAULT 0.0,
    altitudeFt Int32,
    speedKnots Int32,
    headingDeg Int32 DEFAULT 0,
    verticalRateFpm Int32 DEFAULT 0,
    squawk String,
    status String,
    engineTemperature Int32 DEFAULT 700,
    route String,
    origin String,
    destination String
) ENGINE = MergeTree()
ORDER BY (timestamp, flightId);

CREATE TABLE IF NOT EXISTS flight_anomalies (
    anomalyId String,
    timestamp DateTime,
    flightId String,
    callsign String,
    anomalyType String,
    severity String,
    details String,
    altitudeFt Int32,
    speedKnots Int32,
    engineTemperature Int32,
    squawk String
) ENGINE = MergeTree()
ORDER BY (timestamp, flightId);

CREATE TABLE IF NOT EXISTS flight_aggregates (
    windowStart DateTime,
    windowEnd DateTime,
    totalFlights Int32,
    avgAltitude Float64,
    avgSpeed Float64,
    avgEngineTemp Float64,
    maxEngineTemp Int32,
    anomalyCount Int32
) ENGINE = MergeTree()
ORDER BY windowStart;
