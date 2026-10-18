const { createClient } = require('@clickhouse/client');

class ClickHouseService {
  constructor() {
    const rawHost = process.env.CLICKHOUSE_HOST || 'http://localhost:8123';
    const url = rawHost.startsWith('http') ? rawHost : `http://${rawHost}:${process.env.CLICKHOUSE_PORT || '8123'}`;

    this.client = createClient({
      url,
      username: process.env.CLICKHOUSE_USER || 'ch_user',
      password: process.env.CLICKHOUSE_PASSWORD || 'ch_password',
      database: process.env.CLICKHOUSE_DB || 'default',
      request_timeout: 30000
    });
    this.isInitialized = false;
  }

  async init() {
    try {
      // 1. Telemetry
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS flight_telemetry (
            eventId String,
            timestamp DateTime,
            flightId String,
            callsign String,
            airline String DEFAULT 'American Airlines',
            aircraftType String DEFAULT 'Boeing 737-800',
            aircraftRegistration String DEFAULT 'AAL-1000',
            latitude Float64 DEFAULT 0.0,
            longitude Float64 DEFAULT 0.0,
            altitudeFt Int32,
            speedKnots Int32,
            headingDeg Int32 DEFAULT 0,
            verticalRateFpm Int32 DEFAULT 0,
            squawk String DEFAULT '1200',
            flightPhase String DEFAULT 'CRUISE',
            engineTemperature Int32 DEFAULT 700,
            fuelFlowKgh Float64 DEFAULT 2200.0,
            vibrationMmS Float64 DEFAULT 1.1,
            co2EmissionRateKgs Float64 DEFAULT 1.93,
            sensorQuality Float64 DEFAULT 0.98,
            anomalyLabel String DEFAULT 'NORMAL',
            route String,
            origin String,
            destination String
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (airline, flightId, timestamp);
        `
      });

      // 2. Schedules
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS flight_schedules (
            flightId String,
            callsign String,
            airline String,
            origin String,
            destination String,
            scheduledDeparture DateTime,
            actualDeparture DateTime,
            scheduledArrival DateTime,
            actualArrival DateTime,
            status String,
            routeDistanceKm Float64,
            aircraftType String,
            aircraftRegistration String,
            departureDelayMinutes Int32,
            arrivalDelayMinutes Int32,
            weatherCondition String,
            cancellationReason String
          ) ENGINE = ReplacingMergeTree()
          ORDER BY (airline, origin, destination, scheduledDeparture, flightId);
        `
      });

      // 3. Bookings
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS flight_bookings (
            bookingId String,
            flightId String,
            cabinClass String,
            bookedSeats Int32,
            checkInCount Int32,
            boardedCount Int32,
            noShowCount Int32,
            cancelledCount Int32,
            ticketRevenueUsd Float64,
            ancillaryRevenueUsd Float64,
            bookingTimestamp DateTime
          ) ENGINE = MergeTree()
          ORDER BY (flightId, bookingId);
        `
      });

      // 4. Financials
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS flight_financials (
            transactionId String,
            flightId String,
            airline String,
            route String,
            timestamp DateTime,
            ticketRevenue Float64,
            ancillaryRevenue Float64,
            cargoRevenue Float64,
            fuelCost Float64,
            airportFees Float64,
            navigationCharges Float64,
            crewCost Float64,
            maintenanceCost Float64,
            totalRevenue Float64,
            totalOperatingCost Float64,
            operatingProfit Float64,
            operatingMarginPct Float64
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (airline, route, timestamp, flightId);
        `
      });

      // 5. Weather
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS weather_observations (
            observationId String,
            airportCode String,
            timestamp DateTime,
            temperatureC Float64,
            windSpeedKts Float64,
            windDirectionDeg Int32,
            visibilityKm Float64,
            precipitationMm Float64,
            conditionCategory String,
            weatherDelayRisk String
          ) ENGINE = MergeTree()
          ORDER BY (airportCode, timestamp);
        `
      });

      // 6. Fleet Maintenance
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS fleet_maintenance (
            maintenanceId String,
            aircraftRegistration String,
            aircraftType String,
            airline String,
            timestamp DateTime,
            flightHoursTotal Float64,
            flightCyclesTotal Int32,
            engineVibrationAvg Float64,
            lastMaintenanceDate Date,
            nextScheduledCheck String,
            componentStatus String,
            maintenanceDowntimeHours Float64,
            maintenanceCostUsd Float64,
            failureRiskScore Float64
          ) ENGINE = MergeTree()
          ORDER BY (aircraftRegistration, timestamp);
        `
      });

      // 7. Anomalies
      await this.client.exec({
        query: `
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
        `
      });

      // 8. Streaming Aggregates
      await this.client.exec({
        query: `
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
        `
      });

      console.log('✅ ClickHouse Data Warehouse Initialized (All 8 Analytic Domains Online)');
      this.isInitialized = true;
    } catch (err) {
      console.warn('⚠️  ClickHouse Init Notice (Host may be offline or starting up):', err.message);
    }
  }

  // Safe sanitization helper
  _sanitize(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'");
  }

  // -------------------------------------------------------------------------
  // 1. Live Telemetry
  // -------------------------------------------------------------------------
  async getLatestFlights(options = {}) {
    if (!this.isInitialized) await this.init();
    try {
      const whereClauses = ["timestamp >= now() - INTERVAL 10 MINUTE"];
      if (options.airline && options.airline !== 'ALL') {
        whereClauses.push(`airline = '${this._sanitize(options.airline)}'`);
      }
      if (options.status && options.status !== 'ALL') {
        whereClauses.push(`flightPhase = '${this._sanitize(options.status)}'`);
      }
      if (options.search) {
        const s = this._sanitize(options.search);
        whereClauses.push(`(positionCaseInsensitive(flightId, '${s}') > 0 OR positionCaseInsensitive(callsign, '${s}') > 0 OR positionCaseInsensitive(route, '${s}') > 0)`);
      }

      const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const limitStr = options.limit ? `LIMIT ${Number(options.limit)}` : 'LIMIT 500';

      const query = `
        SELECT
          flightId,
          argMax(eventId, timestamp) AS eventId,
          argMax(callsign, timestamp) AS callsign,
          argMax(airline, timestamp) AS airline,
          argMax(aircraftType, timestamp) AS aircraftType,
          argMax(aircraftRegistration, timestamp) AS aircraftRegistration,
          argMax(latitude, timestamp) AS latitude,
          argMax(longitude, timestamp) AS longitude,
          argMax(altitudeFt, timestamp) AS altitudeFt,
          argMax(speedKnots, timestamp) AS speedKnots,
          argMax(headingDeg, timestamp) AS headingDeg,
          argMax(verticalRateFpm, timestamp) AS verticalRateFpm,
          argMax(squawk, timestamp) AS squawk,
          argMax(flightPhase, timestamp) AS flightPhase,
          argMax(engineTemperature, timestamp) AS engineTemperature,
          argMax(fuelFlowKgh, timestamp) AS fuelFlowKgh,
          argMax(vibrationMmS, timestamp) AS vibrationMmS,
          argMax(co2EmissionRateKgs, timestamp) AS co2EmissionRateKgs,
          argMax(anomalyLabel, timestamp) AS anomalyLabel,
          argMax(route, timestamp) AS route,
          argMax(origin, timestamp) AS origin,
          argMax(destination, timestamp) AS destination,
          max(timestamp) AS lastTelemetryUpdate
        FROM flight_telemetry
        ${whereStr}
        GROUP BY flightId
        ORDER BY flightId
        ${limitStr}
      `;

      const res = await this.client.query({ query, format: 'JSONEachRow' });
      const rows = await res.json();

      return rows.map(r => ({
        flightId: r.flightId,
        callsign: r.callsign,
        airline: r.airline || 'Airline',
        aircraftType: r.aircraftType,
        aircraftRegistration: r.aircraftRegistration,
        currentPosition: {
          lat: Number(r.latitude),
          lon: Number(r.longitude),
          altitudeFt: Number(r.altitudeFt),
          speedKnots: Number(r.speedKnots),
          headingDeg: Number(r.headingDeg),
          verticalRateFpm: Number(r.verticalRateFpm)
        },
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        altitudeFt: Number(r.altitudeFt),
        speedKnots: Number(r.speedKnots),
        headingDeg: Number(r.headingDeg),
        verticalRateFpm: Number(r.verticalRateFpm),
        squawk: r.squawk,
        status: r.flightPhase || 'In-Flight',
        flightPhase: r.flightPhase || 'CRUISE',
        engineTemperature: Number(r.engineTemperature),
        fuelFlowKgh: Number(r.fuelFlowKgh || 2200),
        vibrationMmS: Number(r.vibrationMmS || 1.1),
        co2EmissionRateKgs: Number(r.co2EmissionRateKgs || 1.93),
        anomalyLabel: r.anomalyLabel || 'NORMAL',
        route: r.route,
        origin: { code: r.origin || 'UNK' },
        destination: { code: r.destination || 'UNK' },
        lastTelemetryUpdate: r.lastTelemetryUpdate
      }));
    } catch (err) {
      console.warn('ClickHouse getLatestFlights:', err.message);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // 2. Executive Dashboard Overview KPIs
  // -------------------------------------------------------------------------
  async getExecutiveDashboard(filters = {}) {
    if (!this.isInitialized) await this.init();
    try {
      const airlineFilter = filters.airline && filters.airline !== 'ALL'
        ? `WHERE airline = '${this._sanitize(filters.airline)}'` : '';

      // Telemetry totals
      const telemRes = await this.client.query({
        query: `SELECT count() AS totalEvents, count(DISTINCT flightId) AS activeFlights FROM flight_telemetry ${airlineFilter}`,
        format: 'JSONEachRow'
      });
      const telemData = await telemRes.json();
      const totalEvents = Number(telemData[0]?.totalEvents || 0);
      const activeFlights = Number(telemData[0]?.activeFlights || 0);

      // Financial totals
      const finRes = await this.client.query({
        query: `
          SELECT
            round(sum(totalRevenue), 2) AS totalRevenueUsd,
            round(sum(totalOperatingCost), 2) AS totalCostUsd,
            round(sum(operatingProfit), 2) AS netProfitUsd,
            round((sum(operatingProfit) / nullIf(sum(totalRevenue), 0)) * 100, 2) AS marginPct
          FROM flight_financials ${airlineFilter}
        `,
        format: 'JSONEachRow'
      });
      const finData = await finRes.json();

      // Schedules & Punctuality
      const schedRes = await this.client.query({
        query: `
          SELECT
            count() AS totalFlights,
            round(avg(departureDelayMinutes), 1) AS avgDelayMin,
            round((countIf(departureDelayMinutes <= 15) / nullIf(count(), 0)) * 100, 1) AS onTimePct,
            countIf(status = 'CANCELLED') AS cancelledFlights
          FROM flight_schedules ${airlineFilter}
        `,
        format: 'JSONEachRow'
      });
      const schedData = await schedRes.json();

      // Passenger load factor
      const paxRes = await this.client.query({
        query: `
          SELECT
            sum(boardedCount) AS totalBoarded,
            sum(bookedSeats) AS totalBooked,
            round((sum(boardedCount) / nullIf(sum(bookedSeats), 0)) * 100, 1) AS loadFactorPct
          FROM flight_bookings
        `,
        format: 'JSONEachRow'
      });
      const paxData = await paxRes.json();

      // Anomalies count
      const anomRes = await this.client.query({
        query: `SELECT count() AS anomalyCount FROM flight_anomalies`,
        format: 'JSONEachRow'
      });
      const anomData = await anomRes.json();

      return {
        success: true,
        summary: {
          totalEvents: totalEvents || 125000,
          activeFlights: activeFlights || 48,
          totalBoardedPassengers: Number(paxData[0]?.totalBoarded || 85400),
          loadFactorPct: Number(paxData[0]?.loadFactorPct || 84.6),
          onTimePerformancePct: Number(schedData[0]?.onTimePct || 88.2),
          avgDepartureDelayMinutes: Number(schedData[0]?.avgDelayMin || 8.4),
          totalRevenueUsd: Number(finData[0]?.totalRevenueUsd || 14250000),
          totalOperatingCostUsd: Number(finData[0]?.totalCostUsd || 11820000),
          netOperatingProfitUsd: Number(finData[0]?.netProfitUsd || 2430000),
          operatingMarginPct: Number(finData[0]?.marginPct || 17.05),
          anomalyCount: Number(anomData[0]?.anomalyCount || 14),
          cancelledFlights: Number(schedData[0]?.cancelledFlights || 6)
        }
      };
    } catch (err) {
      console.warn('getExecutiveDashboard error:', err.message);
      // Fallback baseline for demo mode
      return {
        success: true,
        simulated: true,
        summary: {
          totalEvents: 500000,
          activeFlights: 54,
          totalBoardedPassengers: 112400,
          loadFactorPct: 83.5,
          onTimePerformancePct: 87.4,
          avgDepartureDelayMinutes: 9.2,
          totalRevenueUsd: 18500000,
          totalOperatingCostUsd: 15320000,
          netOperatingProfitUsd: 3180000,
          operatingMarginPct: 17.19,
          anomalyCount: 18,
          cancelledFlights: 8
        }
      };
    }
  }

  // -------------------------------------------------------------------------
  // 3. Financial Analytics & Route Profitability
  // -------------------------------------------------------------------------
  async getFinancialAnalytics(filters = {}) {
    if (!this.isInitialized) await this.init();
    try {
      const airlineFilter = filters.airline && filters.airline !== 'ALL'
        ? `WHERE airline = '${this._sanitize(filters.airline)}'` : '';

      // Most profitable routes
      const topRoutesRes = await this.client.query({
        query: `
          SELECT
            route,
            airline,
            count() AS flightsCount,
            round(sum(totalRevenue), 2) AS grossRevenue,
            round(sum(totalOperatingCost), 2) AS grossCost,
            round(sum(operatingProfit), 2) AS netProfit,
            round((sum(operatingProfit) / nullIf(sum(totalRevenue), 0)) * 100, 2) AS marginPct
          FROM flight_financials ${airlineFilter}
          GROUP BY route, airline
          ORDER BY netProfit DESC
          LIMIT 10
        `,
        format: 'JSONEachRow'
      });
      const topRoutes = await topRoutesRes.json();

      // Cost breakdown
      const costRes = await this.client.query({
        query: `
          SELECT
            round(sum(fuelCost), 2) AS fuelCost,
            round(sum(airportFees), 2) AS airportFees,
            round(sum(navigationCharges), 2) AS navigationCharges,
            round(sum(crewCost), 2) AS crewCost,
            round(sum(maintenanceCost), 2) AS maintenanceCost
          FROM flight_financials ${airlineFilter}
        `,
        format: 'JSONEachRow'
      });
      const costData = await costRes.json();

      // Trend over time (daily)
      const trendRes = await this.client.query({
        query: `
          SELECT
            toDate(timestamp) AS flightDate,
            round(sum(totalRevenue), 2) AS revenue,
            round(sum(totalOperatingCost), 2) AS cost,
            round(sum(operatingProfit), 2) AS profit
          FROM flight_financials ${airlineFilter}
          GROUP BY flightDate
          ORDER BY flightDate ASC
          LIMIT 30
        `,
        format: 'JSONEachRow'
      });
      const trendData = await trendRes.json();

      return {
        success: true,
        topProfitableRoutes: topRoutes.length > 0 ? topRoutes : [
          { route: "JFK ➔ LHR", airline: "American Airlines", flightsCount: 142, grossRevenue: 8420000, grossCost: 6510000, netProfit: 1910000, marginPct: 22.68 },
          { route: "DXB ➔ LHR", airline: "Emirates", flightsCount: 120, grossRevenue: 9800000, grossCost: 7740000, netProfit: 2060000, marginPct: 21.02 },
          { route: "SIN ➔ SYD", airline: "Singapore Airlines", flightsCount: 98, grossRevenue: 6240000, grossCost: 4980000, netProfit: 1260000, marginPct: 20.19 },
          { route: "LAX ➔ HND", airline: "Delta Air Lines", flightsCount: 88, grossRevenue: 5900000, grossCost: 4780000, netProfit: 1120000, marginPct: 18.98 }
        ],
        costBreakdown: costData[0] || {
          fuelCost: 4200000,
          airportFees: 1850000,
          navigationCharges: 1120000,
          crewCost: 2650000,
          maintenanceCost: 2000000
        },
        dailyFinancialTrend: trendData.length > 0 ? trendData : [
          { flightDate: "2026-01-01", revenue: 540000, cost: 440000, profit: 100000 },
          { flightDate: "2026-01-02", revenue: 610000, cost: 490000, profit: 120000 },
          { flightDate: "2026-01-03", revenue: 580000, cost: 470000, profit: 110000 }
        ]
      };
    } catch (err) {
      console.warn('getFinancialAnalytics error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // -------------------------------------------------------------------------
  // 4. Passenger Analytics & Cabin Load Factor
  // -------------------------------------------------------------------------
  async getPassengerAnalytics(filters = {}) {
    if (!this.isInitialized) await this.init();
    try {
      // Cabin class breakdown
      const cabinRes = await this.client.query({
        query: `
          SELECT
            cabinClass,
            sum(bookedSeats) AS booked,
            sum(boardedCount) AS boarded,
            sum(cancelledCount) AS cancelled,
            sum(noShowCount) AS noShows,
            round(sum(ticketRevenueUsd), 2) AS ticketRev,
            round(sum(ancillaryRevenueUsd), 2) AS ancillaryRev,
            round((sum(boardedCount) / nullIf(sum(bookedSeats), 0)) * 100, 1) AS loadFactorPct
          FROM flight_bookings
          GROUP BY cabinClass
          ORDER BY booked DESC
        `,
        format: 'JSONEachRow'
      });
      const cabinData = await cabinRes.json();

      return {
        success: true,
        cabinBreakdown: cabinData.length > 0 ? cabinData : [
          { cabinClass: "Economy", booked: 74500, boarded: 71200, cancelled: 2100, noShows: 1200, ticketRev: 17808000, ancillaryRev: 2278400, loadFactorPct: 84.8 },
          { cabinClass: "Premium Economy", booked: 12400, boarded: 11900, cancelled: 320, noShows: 180, ticketRev: 7688000, ancillaryRev: 535500, loadFactorPct: 86.2 },
          { cabinClass: "Business", booked: 8200, boarded: 7950, cancelled: 180, noShows: 70, ticketRev: 15170000, ancillaryRev: 516750, loadFactorPct: 82.5 },
          { cabinClass: "First", booked: 1850, boarded: 1810, cancelled: 30, noShows: 10, ticketRev: 7030000, ancillaryRev: 171950, loadFactorPct: 78.4 }
        ],
        bookingFunnel: {
          searches: 850000,
          bookings: 96950,
          checkedIn: 94320,
          boarded: 92860
        }
      };
    } catch (err) {
      console.warn('getPassengerAnalytics error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // -------------------------------------------------------------------------
  // 5. Flight Operations & Delay Distributions
  // -------------------------------------------------------------------------
  async getDelayAnalytics(filters = {}) {
    if (!this.isInitialized) await this.init();
    try {
      const airlineFilter = filters.airline && filters.airline !== 'ALL'
        ? `WHERE airline = '${this._sanitize(filters.airline)}'` : '';

      // Delays by airline
      const airlineDelaysRes = await this.client.query({
        query: `
          SELECT
            airline,
            count() AS flights,
            round(avg(departureDelayMinutes), 1) AS avgDepDelay,
            round(quantile(0.50)(departureDelayMinutes), 1) AS p50Delay,
            round(quantile(0.90)(departureDelayMinutes), 1) AS p90Delay,
            round(quantile(0.95)(departureDelayMinutes), 1) AS p95Delay,
            round((countIf(departureDelayMinutes <= 15) / nullIf(count(), 0)) * 100, 1) AS onTimePct
          FROM flight_schedules ${airlineFilter}
          GROUP BY airline
          ORDER BY flights DESC
          LIMIT 10
        `,
        format: 'JSONEachRow'
      });
      const airlineDelays = await airlineDelaysRes.json();

      // Delay causes / weather correlation
      const weatherDelayRes = await this.client.query({
        query: `
          SELECT
            weatherCondition,
            count() AS flightCount,
            round(avg(departureDelayMinutes), 1) AS avgDelayMinutes
          FROM flight_schedules ${airlineFilter}
          GROUP BY weatherCondition
          ORDER BY avgDelayMinutes DESC
        `,
        format: 'JSONEachRow'
      });
      const weatherDelays = await weatherDelayRes.json();

      return {
        success: true,
        airlinePunctuality: airlineDelays.length > 0 ? airlineDelays : [
          { airline: "Delta Air Lines", flights: 1240, avgDepDelay: 6.2, p50Delay: 3.0, p90Delay: 22.0, p95Delay: 38.0, onTimePct: 91.2 },
          { airline: "American Airlines", flights: 1180, avgDepDelay: 8.5, p50Delay: 4.0, p90Delay: 28.0, p95Delay: 45.0, onTimePct: 87.5 },
          { airline: "United Airlines", flights: 1110, avgDepDelay: 9.1, p50Delay: 5.0, p90Delay: 32.0, p95Delay: 49.0, onTimePct: 85.9 },
          { airline: "Lufthansa", flights: 940, avgDepDelay: 7.4, p50Delay: 3.5, p90Delay: 25.0, p95Delay: 41.0, onTimePct: 89.4 }
        ],
        weatherCorrelation: weatherDelays.length > 0 ? weatherDelays : [
          { weatherCondition: "THUNDERSTORM", flightCount: 140, avgDelayMinutes: 52.4 },
          { weatherCondition: "SNOW", flightCount: 95, avgDelayMinutes: 44.8 },
          { weatherCondition: "FOG", flightCount: 110, avgDelayMinutes: 31.2 },
          { weatherCondition: "RAIN", flightCount: 420, avgDelayMinutes: 14.5 },
          { weatherCondition: "CLEAR", flightCount: 1850, avgDelayMinutes: 4.8 }
        ]
      };
    } catch (err) {
      console.warn('getDelayAnalytics error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // -------------------------------------------------------------------------
  // 6. Environmental Analytics (Fuel & CO2)
  // -------------------------------------------------------------------------
  async getEnvironmentalAnalytics(filters = {}) {
    if (!this.isInitialized) await this.init();
    try {
      const envRes = await this.client.query({
        query: `
          SELECT
            aircraftType,
            count() AS pointsCount,
            round(avg(fuelFlowKgh), 1) AS avgFuelFlowKgh,
            round(sum(fuelFlowKgh / 3600.0 * 3.157), 2) AS estimatedCo2Kg,
            round(avg(speedKnots), 1) AS avgSpeedKnots
          FROM flight_telemetry
          GROUP BY aircraftType
          ORDER BY estimatedCo2Kg DESC
        `,
        format: 'JSONEachRow'
      });
      const envData = await envRes.json();

      return {
        success: true,
        aircraftEmissions: envData.length > 0 ? envData : [
          { aircraftType: "Airbus A380-800", pointsCount: 45000, avgFuelFlowKgh: 11200.0, estimatedCo2Kg: 441980.0, avgSpeedKnots: 485.0 },
          { aircraftType: "Boeing 777-300ER", pointsCount: 82000, avgFuelFlowKgh: 6850.0, estimatedCo2Kg: 492490.0, avgSpeedKnots: 488.0 },
          { aircraftType: "Boeing 787-9 Dreamliner", pointsCount: 94000, avgFuelFlowKgh: 4900.0, estimatedCo2Kg: 403560.0, avgSpeedKnots: 484.0 },
          { aircraftType: "Airbus A350-900", pointsCount: 78000, avgFuelFlowKgh: 5050.0, estimatedCo2Kg: 345620.0, avgSpeedKnots: 487.0 },
          { aircraftType: "Airbus A321neo", pointsCount: 145000, avgFuelFlowKgh: 2380.0, estimatedCo2Kg: 302840.0, avgSpeedKnots: 452.0 },
          { aircraftType: "Boeing 737 MAX 8", pointsCount: 160000, avgFuelFlowKgh: 2160.0, estimatedCo2Kg: 302910.0, avgSpeedKnots: 451.0 }
        ]
      };
    } catch (err) {
      console.warn('getEnvironmentalAnalytics error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // -------------------------------------------------------------------------
  // 7. Aircraft Health & Predictive Maintenance
  // -------------------------------------------------------------------------
  async getFleetHealthAnalytics(filters = {}) {
    if (!this.isInitialized) await this.init();
    try {
      const fleetRes = await this.client.query({
        query: `
          SELECT
            aircraftRegistration,
            aircraftType,
            airline,
            round(flightHoursTotal, 1) AS flightHours,
            flightCyclesTotal AS cycles,
            round(engineVibrationAvg, 2) AS vibrationAvg,
            nextScheduledCheck AS nextCheck,
            componentStatus AS status,
            round(failureRiskScore, 4) AS riskScore,
            round(maintenanceCostUsd, 2) AS maintCost
          FROM fleet_maintenance
          ORDER BY failureRiskScore DESC
          LIMIT 20
        `,
        format: 'JSONEachRow'
      });
      const fleetData = await fleetRes.json();

      return {
        success: true,
        highRiskAirframes: fleetData.length > 0 ? fleetData : [
          { aircraftRegistration: "AAL-2045", aircraftType: "Boeing 777-300ER", airline: "American Airlines", flightHours: 42150.0, cycles: 8430, vibrationAvg: 3.92, nextCheck: "CHECK_C", status: "CRITICAL", riskScore: 0.8950, maintCost: 285000.0 },
          { aircraftRegistration: "DAL-3112", aircraftType: "Boeing 737-800", airline: "Delta Air Lines", flightHours: 38400.0, cycles: 15360, vibrationAvg: 3.65, nextCheck: "CHECK_B", status: "MONITOR_REQUIRED", riskScore: 0.7620, maintCost: 42000.0 },
          { aircraftRegistration: "BAW-1088", aircraftType: "Airbus A350-900", airline: "British Airways", flightHours: 19800.0, cycles: 3960, vibrationAvg: 3.48, nextCheck: "CHECK_A", status: "MONITOR_REQUIRED", riskScore: 0.6840, maintCost: 14500.0 }
        ]
      };
    } catch (err) {
      console.warn('getFleetHealthAnalytics error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // -------------------------------------------------------------------------
  // 8. Airport Ground Operations
  // -------------------------------------------------------------------------
  async getAirportAnalytics(filters = {}) {
    if (!this.isInitialized) await this.init();
    try {
      const aptRes = await this.client.query({
        query: `
          SELECT
            origin AS airportCode,
            count() AS departures,
            round(avg(departureDelayMinutes), 1) AS avgDelayMinutes,
            countIf(departureDelayMinutes <= 15) / count() * 100 AS onTimeRate,
            countIf(status = 'CANCELLED') AS cancellations
          FROM flight_schedules
          GROUP BY origin
          ORDER BY departures DESC
          LIMIT 12
        `,
        format: 'JSONEachRow'
      });
      const aptData = await aptRes.json();

      return {
        success: true,
        airports: aptData.length > 0 ? aptData : [
          { airportCode: "JFK", departures: 420, avgDelayMinutes: 11.2, onTimeRate: 84.5, cancellations: 4 },
          { airportCode: "LHR", departures: 390, avgDelayMinutes: 9.8, onTimeRate: 86.8, cancellations: 2 },
          { airportCode: "ORD", departures: 380, avgDelayMinutes: 13.5, onTimeRate: 81.2, cancellations: 5 },
          { airportCode: "LAX", departures: 350, avgDelayMinutes: 7.4, onTimeRate: 89.4, cancellations: 1 },
          { airportCode: "DXB", departures: 310, avgDelayMinutes: 5.6, onTimeRate: 92.1, cancellations: 1 },
          { airportCode: "FRA", departures: 290, avgDelayMinutes: 8.9, onTimeRate: 87.5, cancellations: 2 }
        ]
      };
    } catch (err) {
      console.warn('getAirportAnalytics error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // -------------------------------------------------------------------------
  // Legacy Analytics Report (used by existing UI endpoints)
  // -------------------------------------------------------------------------
  async getAnalyticsReport() {
    if (!this.isInitialized) await this.init();
    try {
      const exec = await this.getExecutiveDashboard();
      const fin = await this.getFinancialAnalytics();
      const delay = await this.getDelayAnalytics();

      return {
        clusterIdentifier: 'bda-clickhouse-cluster',
        database: 'flight_telemetry',
        status: 'AVAILABLE',
        nodeType: 'clickhouse-server',
        dwData: {
          lastEtlTimestamp: new Date().toISOString(),
          totalProcessedEvents: exec.summary.totalEvents,
          activeFlights: exec.summary.activeFlights,
          totalAnomalies: exec.summary.anomalyCount,
          hourlyFlightDensity: [
            { hour: "00:00", activeFlights: 32, ingestedEvents: 14200, avgSpeedKnots: 460 },
            { hour: "04:00", activeFlights: 24, ingestedEvents: 11800, avgSpeedKnots: 455 },
            { hour: "08:00", activeFlights: 58, ingestedEvents: 28400, avgSpeedKnots: 472 },
            { hour: "12:00", activeFlights: 64, ingestedEvents: 31200, avgSpeedKnots: 468 },
            { hour: "16:00", activeFlights: 61, ingestedEvents: 29800, avgSpeedKnots: 465 },
            { hour: "20:00", activeFlights: 46, ingestedEvents: 21500, avgSpeedKnots: 462 }
          ],
          routePerformanceStats: (fin.topProfitableRoutes || []).map(r => ({
            route: r.route,
            flightsCount: r.flightsCount,
            avgSpeedKnots: 465,
            netProfit: r.netProfit,
            marginPct: r.marginPct
          })),
          altitudeBandDistribution: [
            { band: "FL380 - FL450 (High Cruise)", count: 24500, percentage: 38 },
            { band: "FL310 - FL370 (Standard Cruise)", count: 28000, percentage: 43 },
            { band: "FL200 - FL300 (Mid Climb/Descent)", count: 8500, percentage: 13 },
            { band: "Below FL200 (Terminal Area)", count: 4000, percentage: 6 }
          ]
        }
      };
    } catch (err) {
      console.warn('getAnalyticsReport error:', err.message);
      return {
        clusterIdentifier: 'bda-clickhouse-cluster',
        database: 'flight_telemetry',
        status: 'OFFLINE_FALLBACK',
        dwData: {
          totalProcessedEvents: 120000,
          activeFlights: 45,
          totalAnomalies: 12,
          hourlyFlightDensity: [],
          routePerformanceStats: [],
          altitudeBandDistribution: []
        }
      };
    }
  }

  // -------------------------------------------------------------------------
  // Anomalies
  // -------------------------------------------------------------------------
  async getRecentAnomalies(limit = 50) {
    if (!this.isInitialized) await this.init();
    try {
      const query = `
        SELECT *
        FROM flight_anomalies
        ORDER BY timestamp DESC
        LIMIT ${Number(limit)}
      `;
      const res = await this.client.query({ query, format: 'JSONEachRow' });
      const rows = await res.json();
      return rows.map(r => ({
        alertId: r.anomalyId,
        anomalyId: r.anomalyId,
        type: r.anomalyType,
        severity: r.severity,
        flightId: r.flightId,
        callsign: r.callsign,
        message: r.details,
        squawkCode: r.squawk,
        engineTemperature: Number(r.engineTemperature),
        altitudeFt: Number(r.altitudeFt),
        speedKnots: Number(r.speedKnots),
        timestamp: r.timestamp
      }));
    } catch (err) {
      console.warn('getRecentAnomalies error:', err.message);
      return [];
    }
  }
}

module.exports = new ClickHouseService();
