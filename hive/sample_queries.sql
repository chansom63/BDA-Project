-- ============================================================================
-- Representative Historical Analytical Queries for Hive & Spark SQL
-- ============================================================================

USE flight_dw;

-- 1. Average Altitude and Speed by Aircraft Model
SELECT 
    aircraftType,
    COUNT(DISTINCT flightId) AS active_aircraft_count,
    ROUND(AVG(altitudeFt), 1) AS avg_altitude_ft,
    ROUND(AVG(speedKnots), 1) AS avg_speed_knots
FROM processed_telemetry
GROUP BY aircraftType
ORDER BY active_aircraft_count DESC;

-- 2. Peak Engine Temperature and Overheat Incidents by Airline
SELECT 
    airline,
    COUNT(flightId) AS total_telemetry_reports,
    ROUND(AVG(engineTemperature), 1) AS avg_engine_temp_c,
    MAX(engineTemperature) AS peak_engine_temp_c,
    SUM(CASE WHEN engineTemperature >= 900 THEN 1 ELSE 0 END) AS overheat_alerts
FROM processed_telemetry
GROUP BY airline
ORDER BY peak_engine_temp_c DESC;

-- 3. Top Flight Routes / Corridors
SELECT 
    origin.code AS departure,
    destination.code AS arrival,
    COUNT(DISTINCT flightId) AS flight_volume,
    ROUND(AVG(speedKnots), 0) AS avg_ground_speed
FROM processed_telemetry
GROUP BY origin.code, destination.code
ORDER BY flight_volume DESC
LIMIT 10;

-- 4. Anomaly Counts and Breakdown by Severity
SELECT 
    anomalyType,
    severity,
    COUNT(*) AS total_incidents,
    ROUND(AVG(altitudeFt), 0) AS avg_altitude,
    ROUND(AVG(engineTemperature), 0) AS avg_egt
FROM flight_anomalies
GROUP BY anomalyType, severity
ORDER BY total_incidents DESC;
