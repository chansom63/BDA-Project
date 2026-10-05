const { createClient } = require('@clickhouse/client');

class ClickHouseService {
  constructor() {
    this.client = createClient({
      host: 'http://localhost:8123',
      username: 'ch_user',
      password: 'ch_password',
      database: 'default'
    });
    this.isInitialized = false;
  }

  async init() {
    // initialize clickhouse
    try {
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS flight_telemetry (
            eventId String,
            timestamp DateTime,
            flightId String,
            callsign String,
            altitudeFt Int32,
            speedKnots Int32,
            squawk String,
            status String,
            route String,
            origin String,
            destination String
          ) ENGINE = MergeTree()
          ORDER BY (timestamp, flightId)
        `
      });
      console.log('✅ ClickHouse Data Warehouse Initialized');
      this.isInitialized = true;
    } catch (err) {
      console.error('❌ ClickHouse Init Error:', err.message);
    }
  }

  async insertBatch(batch) {
    if (!this.isInitialized || !batch || batch.length === 0) return;

    try {
      const values = batch.map(evt => ({
        eventId: evt.eventId,
        timestamp: evt.timestamp.replace('T', ' ').substring(0, 19),
        flightId: evt.flightId,
        callsign: evt.callsign,
        altitudeFt: evt.altitudeFt,
        speedKnots: evt.speedKnots,
        squawk: evt.squawk,
        status: evt.status,
        route: `${evt.origin.code} ➔ ${evt.destination.code}`,
        origin: evt.origin.code,
        destination: evt.destination.code
      }));

      await this.client.insert({
        table: 'flight_telemetry',
        values,
        format: 'JSONEachRow'
      });
      // console.log(`💾 Inserted ${values.length} records to ClickHouse`);
    } catch (err) {
      console.error('❌ ClickHouse Insert Error:', err.message);
    }
  }

  async getAnalyticsReport() {
    if (!this.isInitialized) {
      return this.getFallbackData();
    }

    try {
      // 1. Total events
      const totalRes = await this.client.query({ query: 'SELECT count() as count FROM flight_telemetry', format: 'JSONEachRow' });
      const totalData = await totalRes.json();
      const totalProcessedEvents = Number(totalData[0].count);

      // 2. Hourly Flight Density
      const hourlyRes = await this.client.query({ query: `
        SELECT 
          toHour(timestamp) as hr, 
          count(DISTINCT flightId) as activeFlights, 
          count() as ingestedEvents, 
          avg(speedKnots) as avgSpeedKnots 
        FROM flight_telemetry 
        GROUP BY hr 
        ORDER BY hr
      `, format: 'JSONEachRow' });
      const hourlyData = await hourlyRes.json();
      
      const hourlyFlightDensity = hourlyData.map(r => ({
        hour: `${String(r.hr).padStart(2, '0')}:00`,
        activeFlights: Number(r.activeFlights),
        ingestedEvents: Number(r.ingestedEvents),
        avgSpeedKnots: Math.round(Number(r.avgSpeedKnots))
      }));

      // 3. Route Performance Stats
      const routeRes = await this.client.query({ query: `
        SELECT 
          route, 
          count(DISTINCT flightId) as flightsCount, 
          avg(speedKnots) as avgSpeedKnots
        FROM flight_telemetry 
        GROUP BY route 
        ORDER BY flightsCount DESC 
        LIMIT 6
      `, format: 'JSONEachRow' });
      const routeData = await routeRes.json();

      const routePerformanceStats = routeData.map(r => ({
        route: r.route,
        flightsCount: Number(r.flightsCount),
        avgDurationHours: 8.0, // Mocked for simplicity
        onTimePct: 90, // Mocked for simplicity
        avgSpeedKnots: Math.round(Number(r.avgSpeedKnots))
      }));

      // 4. Altitude Band Distribution
      const altRes = await this.client.query({ query: `
        SELECT 
          multiIf(altitudeFt >= 38000, 'FL380 - FL450 (High Cruise)', 
                  altitudeFt >= 31000, 'FL310 - FL370 (Standard Cruise)', 
                  altitudeFt >= 20000, 'FL200 - FL300 (Mid Climb/Descent)', 
                  'Below FL200 (Terminal Area)') as band,
          count() as count
        FROM flight_telemetry
        GROUP BY band
      `, format: 'JSONEachRow' });
      const altData = await altRes.json();
      const totalAltCount = altData.reduce((acc, row) => acc + Number(row.count), 0);

      const altitudeBandDistribution = altData.map(r => ({
        band: r.band,
        count: Number(r.count),
        percentage: totalAltCount > 0 ? Math.round((Number(r.count) / totalAltCount) * 100) : 0
      }));

      // 5. Delay Factor Analysis (Keep mocked since we don't have this in telemetry)
      const delayFactorAnalysis = [
        { factor: 'Air Traffic Control Hold', count: 45, impactMinutes: 18 },
        { factor: 'North Atlantic Weather Avoidance', count: 32, impactMinutes: 24 },
        { factor: 'Headwinds / Jet Stream Shift', count: 28, impactMinutes: 14 }
      ];

      return {
        clusterIdentifier: 'bda-clickhouse-cluster',
        database: 'flight_telemetry',
        status: 'AVAILABLE',
        nodeType: 'clickhouse-server',
        dwData: {
          lastEtlTimestamp: new Date().toISOString(),
          totalProcessedEvents,
          hourlyFlightDensity,
          routePerformanceStats,
          altitudeBandDistribution,
          squawkEventDistribution: [], // Omitted for brevity
          delayFactorAnalysis
        }
      };

    } catch (err) {
      console.error('❌ ClickHouse Query Error:', err.message);
      return this.getFallbackData();
    }
  }

  getFallbackData() {
    return {
      clusterIdentifier: 'bda-clickhouse-cluster',
      database: 'flight_telemetry',
      status: 'UNAVAILABLE',
      nodeType: 'clickhouse-server',
      dwData: {
        lastEtlTimestamp: new Date().toISOString(),
        totalProcessedEvents: 0,
        hourlyFlightDensity: [],
        routePerformanceStats: [],
        altitudeBandDistribution: [],
        squawkEventDistribution: [],
        delayFactorAnalysis: []
      }
    };
  }
}

module.exports = new ClickHouseService();
