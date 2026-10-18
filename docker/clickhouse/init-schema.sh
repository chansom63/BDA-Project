#!/bin/bash
# ============================================================================
# ClickHouse schema initializer — runs on EVERY container start.
# Ensures all tables, Kafka engine queues, and MVs are present.
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

run_sql "flight_telemetry table" "
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
"

run_sql "flight_schedules table" "
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
"

run_sql "flight_bookings table" "
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
"

run_sql "flight_financials table" "
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
"

run_sql "weather_observations table" "
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
"

run_sql "fleet_maintenance table" "
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
"

run_sql "flight_anomalies table" "
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
"

run_sql "flight_aggregates table" "
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
"

echo "✅ ClickHouse schema initialization complete."
