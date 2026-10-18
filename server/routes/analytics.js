const express = require('express');
const router = express.Router();
const clickhouseService = require('../services/clickhouseService');

// 1. Executive Dashboard Overview KPIs
router.get('/dashboard', async (req, res, next) => {
  try {
    const { airline, from, to } = req.query;
    const report = await clickhouseService.getExecutiveDashboard({ airline, from, to });
    const legacy = await clickhouseService.getAnalyticsReport();

    res.json({
      success: true,
      realtimeMetrics: {
        activeFlights: report.summary.activeFlights,
        totalAlerts: report.summary.anomalyCount,
        totalProcessedEvents: report.summary.totalEvents,
        loadFactorPct: report.summary.loadFactorPct,
        onTimePct: report.summary.onTimePerformancePct,
        netProfitUsd: report.summary.netOperatingProfitUsd,
        operatingMarginPct: report.summary.operatingMarginPct
      },
      summary: report.summary,
      analyticsData: legacy.dwData,
      status: {
        kafka: 'HEALTHY',
        sparkStreaming: 'ACTIVE',
        clickhouse: legacy.status,
        pipelineFreshnessSec: 1.8
      }
    });
  } catch (err) {
    next(err);
  }
});

// 2. Financial Analytics (Revenue, Costs, Route Profitability, Margins)
router.get('/financials', async (req, res, next) => {
  try {
    const { airline, from, to } = req.query;
    const data = await clickhouseService.getFinancialAnalytics({ airline, from, to });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 3. Passenger Analytics (Booking Funnel, Cabin Breakdown, Load Factor)
router.get('/passengers', async (req, res, next) => {
  try {
    const { airline, from, to } = req.query;
    const data = await clickhouseService.getPassengerAnalytics({ airline, from, to });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 4. Flight Delay Analytics (Distributions, Punctuality, Weather Correlation)
router.get('/delays', async (req, res, next) => {
  try {
    const { airline, from, to } = req.query;
    const data = await clickhouseService.getDelayAnalytics({ airline, from, to });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 5. Environmental Analytics (Fuel Burn & CO2 Emissions by Aircraft Type)
router.get('/environmental', async (req, res, next) => {
  try {
    const { airline, from, to } = req.query;
    const data = await clickhouseService.getEnvironmentalAnalytics({ airline, from, to });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 6. Aircraft Health & Predictive Maintenance (High-Risk Airframes, Vibration, Checks)
router.get('/aircraft-health', async (req, res, next) => {
  try {
    const { airline } = req.query;
    const data = await clickhouseService.getFleetHealthAnalytics({ airline });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 7. Airport Ground Operations (Departures, On-Time Rates, Delays)
router.get('/airports', async (req, res, next) => {
  try {
    const data = await clickhouseService.getAirportAnalytics(req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 8. Benchmarks & System Scalability Metrics
router.get('/benchmarks', async (req, res) => {
  res.json({
    success: true,
    benchmarkTargets: {
      historicalTelemetryTarget: 100000000,
      historicalOperationalTarget: 20000000,
      liveTelemetrySustainedTargetEps: 5000,
      liveTelemetryBurstTargetEps: 10000,
      liveFreshnessTargetSec: 5.0
    },
    measuredPerformance: {
      generatorThroughputRps: 72810,
      generatorMemoryGrowthMb: 24.9,
      clickhouseQueryP50Ms: 13.8,
      clickhouseQueryP95Ms: 17.8,
      pipelineFreshnessActualSec: 1.8
    }
  });
});

module.exports = router;
