const { createClient } = require('@clickhouse/client');

class ClickHouseService {
  constructor() {
    const rawHost = process.env.CLICKHOUSE_HOST || 'http://localhost:8123';
    const url = rawHost.startsWith('http') ? rawHost : `http://${rawHost}:${process.env.CLICKHOUSE_PORT || '8123'}`;

    this.client = createClient({
      url,
      username: process.env.CLICKHOUSE_USER || 'ch_user',
      password: process.env.CLICKHOUSE_PASSWORD || 'ch_password',
      database: process.env.CLICKHOUSE_DB || 'default'
    });
    this.isInitialized = false;
  }

  async init() {
    try {
      await this.client.exec({
        query: `
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
        `
      });

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

      console.log('✅ ClickHouse Data Warehouse Initialized (Tables: flight_telemetry, flight_anomalies, flight_aggregates)');
      this.isInitialized = true;
    } catch (err) {
      console.error('❌ ClickHouse Init Error:', err.message);
    }
  }

  async getLatestFlights(options = {}) {
    if (!this.isInitialized) await this.init();
    try {
      const whereClauses = ["timestamp >= now() - INTERVAL 5 MINUTE"];

      if (options.status && options.status !== 'ALL') {
        whereClauses.push(`status = '${options.status.replace(/'/g, "\\'")}'`);
      }
      if (options.search) {
        const s = options.search.replace(/'/g, "\\'");
        whereClauses.push(`(positionCaseInsensitive(flightId, '${s}') > 0 OR positionCaseInsensitive(callsign, '${s}') > 0 OR positionCaseInsensitive(route, '${s}') > 0)`);
      }
      if (options.minLat !== undefined && options.maxLat !== undefined && options.minLon !== undefined && options.maxLon !== undefined) {
        whereClauses.push(`latitude >= ${Number(options.minLat)} AND latitude <= ${Number(options.maxLat)} AND longitude >= ${Number(options.minLon)} AND longitude <= ${Number(options.maxLon)}`);
      }

      const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const limitStr = options.limit ? `LIMIT ${Number(options.limit)}` : 'LIMIT 2000';

      const query = `
        SELECT
          flightId,
          argMax(eventId, timestamp) AS eventId,
          argMax(callsign, timestamp) AS callsign,
          argMax(latitude, timestamp) AS latitude,
          argMax(longitude, timestamp) AS longitude,
          argMax(altitudeFt, timestamp) AS altitudeFt,
          argMax(speedKnots, timestamp) AS speedKnots,
          argMax(headingDeg, timestamp) AS headingDeg,
          argMax(verticalRateFpm, timestamp) AS verticalRateFpm,
          argMax(squawk, timestamp) AS squawk,
          argMax(status, timestamp) AS status,
          argMax(engineTemperature, timestamp) AS engineTemperature,
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
        airline: r.callsign ? r.callsign.substring(0, 3) : 'Flight',
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
        status: r.status,
        engineTemperature: Number(r.engineTemperature),
        route: r.route,
        origin: { code: r.origin || 'UNK' },
        destination: { code: r.destination || 'UNK' },
        lastTelemetryUpdate: r.lastTelemetryUpdate
      }));
    } catch (err) {
      console.error('❌ ClickHouse getLatestFlights Error:', err.message);
      return [];
    }
  }

  async getFlightById(flightId) {
    if (!this.isInitialized) await this.init();
    try {
      const cleanId = flightId.replace(/'/g, "\\'");
      const query = `
        SELECT *
        FROM flight_telemetry
        WHERE flightId = '${cleanId}'
        ORDER BY timestamp DESC
        LIMIT 50
      `;
      const res = await this.client.query({ query, format: 'JSONEachRow' });
      const rows = await res.json();
      if (!rows || rows.length === 0) return null;

      const latest = rows[0];
      const trajectory = rows.slice().reverse().map(pt => [Number(pt.latitude), Number(pt.longitude)]);

      return {
        flightId: latest.flightId,
        callsign: latest.callsign,
        airline: latest.callsign ? latest.callsign.substring(0, 3) : 'Flight',
        currentPosition: {
          lat: Number(latest.latitude),
          lon: Number(latest.longitude),
          altitudeFt: Number(latest.altitudeFt),
          speedKnots: Number(latest.speedKnots),
          headingDeg: Number(latest.headingDeg),
          verticalRateFpm: Number(latest.verticalRateFpm)
        },
        latitude: Number(latest.latitude),
        longitude: Number(latest.longitude),
        altitudeFt: Number(latest.altitudeFt),
        speedKnots: Number(latest.speedKnots),
        headingDeg: Number(latest.headingDeg),
        verticalRateFpm: Number(latest.verticalRateFpm),
        squawk: latest.squawk,
        status: latest.status,
        engineTemperature: Number(latest.engineTemperature),
        route: latest.route,
        origin: { code: latest.origin || 'UNK' },
        destination: { code: latest.destination || 'UNK' },
        trajectory,
        lastTelemetryUpdate: latest.timestamp
      };
    } catch (err) {
      console.error('❌ ClickHouse getFlightById Error:', err.message);
      return null;
    }
  }

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
      console.error('❌ ClickHouse getRecentAnomalies Error:', err.message);
      return [];
    }
  }

  async getAnalyticsReport() {
    if (!this.isInitialized) await this.init();

    try {
      const totalRes = await this.client.query({ query: 'SELECT count() as count FROM flight_telemetry', format: 'JSONEachRow' });
      const totalData = await totalRes.json();
      const totalProcessedEvents = Number(totalData[0].count);

      const activeFlightsRes = await this.client.query({
        query: 'SELECT count(DISTINCT flightId) as count FROM flight_telemetry WHERE timestamp >= now() - INTERVAL 5 MINUTE',
        format: 'JSONEachRow'
      });
      const activeFlightsData = await activeFlightsRes.json();
      const activeFlights = Number(activeFlightsData[0].count);

      const anomaliesRes = await this.client.query({
        query: 'SELECT count() as count FROM flight_anomalies',
        format: 'JSONEachRow'
      });
      const anomaliesData = await anomaliesRes.json();
      const totalAnomalies = Number(anomaliesData[0].count);

      const hourlyRes = await this.client.query({
        query: `
          SELECT 
            toHour(timestamp) as hr, 
            count(DISTINCT flightId) as activeFlights, 
            count() as ingestedEvents, 
            avg(speedKnots) as avgSpeedKnots 
          FROM flight_telemetry 
          GROUP BY hr 
          ORDER BY hr
        `,
        format: 'JSONEachRow'
      });
      const hourlyData = await hourlyRes.json();

      const hourlyFlightDensity = hourlyData.map(r => ({
        hour: `${String(r.hr).padStart(2, '0')}:00`,
        activeFlights: Number(r.activeFlights),
        ingestedEvents: Number(r.ingestedEvents),
        avgSpeedKnots: Math.round(Number(r.avgSpeedKnots))
      }));

      const routeRes = await this.client.query({
        query: `
          SELECT 
            route, 
            count(DISTINCT flightId) as flightsCount, 
            avg(speedKnots) as avgSpeedKnots
          FROM flight_telemetry 
          GROUP BY route 
          ORDER BY flightsCount DESC 
          LIMIT 6
        `,
        format: 'JSONEachRow'
      });
      const routeData = await routeRes.json();

      const routePerformanceStats = routeData.map(r => ({
        route: r.route,
        flightsCount: Number(r.flightsCount),
        avgSpeedKnots: Math.round(Number(r.avgSpeedKnots))
      }));

      const altRes = await this.client.query({
        query: `
          SELECT 
            multiIf(altitudeFt >= 38000, 'FL380 - FL450 (High Cruise)', 
                    altitudeFt >= 31000, 'FL310 - FL370 (Standard Cruise)', 
                    altitudeFt >= 20000, 'FL200 - FL300 (Mid Climb/Descent)', 
                    'Below FL200 (Terminal Area)') as band,
            count() as count
          FROM flight_telemetry
          GROUP BY band
        `,
        format: 'JSONEachRow'
      });
      const altData = await altRes.json();
      const totalAltCount = altData.reduce((acc, row) => acc + Number(row.count), 0);

      const altitudeBandDistribution = altData.map(r => ({
        band: r.band,
        count: Number(r.count),
        percentage: totalAltCount > 0 ? Math.round((Number(r.count) / totalAltCount) * 100) : 0
      }));

      return {
        clusterIdentifier: 'bda-clickhouse-cluster',
        database: 'flight_telemetry',
        status: 'AVAILABLE',
        nodeType: 'clickhouse-server',
        dwData: {
          lastEtlTimestamp: new Date().toISOString(),
          totalProcessedEvents,
          activeFlights,
          totalAnomalies,
          hourlyFlightDensity,
          routePerformanceStats,
          altitudeBandDistribution
        }
      };

    } catch (err) {
      console.error('❌ ClickHouse Query Error:', err.message);
      return {
        clusterIdentifier: 'bda-clickhouse-cluster',
        database: 'flight_telemetry',
        status: 'ERROR',
        dwData: { totalProcessedEvents: 0, activeFlights: 0, totalAnomalies: 0 }
      };
    }
  }
}

module.exports = new ClickHouseService();
