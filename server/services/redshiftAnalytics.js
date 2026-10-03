const fs = require('fs');
const path = require('path');
const awsConfig = require('../config/awsConfig');

const dwFile = path.join(__dirname, '../data/redshift_dw/dw_summary.json');

class RedshiftAnalyticsService {
  constructor() {
    this.dwData = {
      lastEtlTimestamp: new Date().toISOString(),
      totalProcessedEvents: 145200,
      hourlyFlightDensity: [],
      routePerformanceStats: [],
      altitudeBandDistribution: [],
      squawkEventDistribution: [],
      delayFactorAnalysis: []
    };

    this.initDefaultDW();
  }

  initDefaultDW() {
    // Generate realistic historical analytics data for QuickSight BI dashboards
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    
    this.dwData.hourlyFlightDensity = hours.map((h, i) => ({
      hour: h,
      activeFlights: Math.floor(180 + Math.sin(i / 3) * 60 + Math.random() * 20),
      ingestedEvents: Math.floor(12000 + Math.random() * 3000),
      avgSpeedKnots: Math.floor(465 + Math.random() * 30)
    }));

    this.dwData.routePerformanceStats = [
      { route: 'JFK ➔ LHR', flightsCount: 42, avgDurationHours: 6.8, onTimePct: 92, avgSpeedKnots: 495 },
      { route: 'LHR ➔ LAX', flightsCount: 38, avgDurationHours: 10.5, onTimePct: 88, avgSpeedKnots: 480 },
      { route: 'LAX ➔ JFK', flightsCount: 56, avgDurationHours: 5.2, onTimePct: 95, avgSpeedKnots: 510 },
      { route: 'SFO ➔ HND', flightsCount: 29, avgDurationHours: 11.2, onTimePct: 91, avgSpeedKnots: 470 },
      { route: 'DXB ➔ JFK', flightsCount: 34, avgDurationHours: 13.6, onTimePct: 86, avgSpeedKnots: 485 },
      { route: 'FRA ➔ JFK', flightsCount: 31, avgDurationHours: 8.1, onTimePct: 94, avgSpeedKnots: 475 }
    ];

    this.dwData.altitudeBandDistribution = [
      { band: 'FL380 - FL450 (High Cruise)', count: 48, percentage: 38 },
      { band: 'FL310 - FL370 (Standard Cruise)', count: 58, percentage: 46 },
      { band: 'FL200 - FL300 (Mid Climb/Descent)', count: 14, percentage: 11 },
      { band: 'Below FL200 (Terminal Area)', count: 6, percentage: 5 }
    ];

    this.dwData.squawkEventDistribution = [
      { code: '1200 / Standard', label: 'Normal Navigation', count: 1240 },
      { code: '7700', label: 'General Emergency', count: 3 },
      { code: '7600', label: 'Radio Loss / Comms', count: 1 },
      { code: '7500', label: 'Unlawful Interference', count: 0 }
    ];

    this.dwData.delayFactorAnalysis = [
      { factor: 'Air Traffic Control Hold', count: 45, impactMinutes: 18 },
      { factor: 'North Atlantic Weather Avoidance', count: 32, impactMinutes: 24 },
      { factor: 'Headwinds / Jet Stream Shift', count: 28, impactMinutes: 14 },
      { factor: 'Airport Gate Congestion', count: 19, impactMinutes: 12 }
    ];

    this.saveDW();
  }

  saveDW() {
    try {
      const dir = path.dirname(dwFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(dwFile, JSON.stringify(this.dwData, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving Redshift DW state:', err.message);
    }
  }

  recordBatchEtlUpdate(eventCount) {
    this.dwData.lastEtlTimestamp = new Date().toISOString();
    this.dwData.totalProcessedEvents += eventCount;
    this.saveDW();
  }

  getAnalyticsReport() {
    return {
      clusterIdentifier: awsConfig.redshift.clusterIdentifier,
      database: awsConfig.redshift.database,
      status: awsConfig.redshift.status,
      nodeType: awsConfig.redshift.nodeType,
      dwData: this.dwData
    };
  }
}

module.exports = new RedshiftAnalyticsService();
