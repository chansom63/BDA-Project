-- ============================================================================
-- Apache Hive DDL: External Tables Mapping to HDFS Flight Telemetry Storage
-- ============================================================================

CREATE DATABASE IF NOT EXISTS flight_dw;
USE flight_dw;

-- 1. External Table: Processed Telemetry Events
CREATE EXTERNAL TABLE IF NOT EXISTS processed_telemetry (
    eventId STRING,
    timestamp STRING,
    icao24 STRING,
    callsign STRING,
    flightId STRING,
    airline STRING,
    aircraftType STRING,
    registration STRING,
    latitude DOUBLE,
    longitude DOUBLE,
    altitudeFt INT,
    speedKnots INT,
    headingDeg INT,
    verticalRateFpm INT,
    squawk STRING,
    status STRING,
    progressPct INT,
    weatherTurbulence STRING,
    engineTemperature INT,
    std STRING,
    atd STRING,
    sta STRING,
    eta STRING
)
ROW FORMAT SERDE 'org.apache.hive.hcatalog.data.JsonSerDe'
STORED AS TEXTFILE
LOCATION '/flight-telemetry/processed';

-- 2. External Table: Detected Anomalies
CREATE EXTERNAL TABLE IF NOT EXISTS flight_anomalies (
    anomalyId STRING,
    timestamp STRING,
    flightId STRING,
    callsign STRING,
    anomalyType STRING,
    severity STRING,
    details STRING,
    altitudeFt INT,
    speedKnots INT,
    engineTemperature INT,
    squawk STRING
)
ROW FORMAT SERDE 'org.apache.hive.hcatalog.data.JsonSerDe'
STORED AS TEXTFILE
LOCATION '/flight-telemetry/anomalies';
