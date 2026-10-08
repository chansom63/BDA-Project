import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { BarChart3, Database, RefreshCw, Layers, TrendingUp } from 'lucide-react';

const COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#a855f7', '#38bdf8'];

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching Spark data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading || !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
        <RefreshCw size={32} className="spin" style={{ marginBottom: '12px', color: '#10b981' }} />
        <div>Loading Apache Spark BI Dashboard...</div>
      </div>
    );
  }

  const { redshiftData, realtimeMetrics } = data;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff' }}>Apache Spark Operational BI Dashboards</h2>
            <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', fontSize: '11px', fontWeight: '700', padding: '2px 10px', borderRadius: '12px' }}>
              CONNECTED TO APACHE SPARK
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>Historical flight route statistics, altitude band distribution & stream analytics</p>
        </div>

        <button className="btn-secondary" onClick={fetchDashboardData} style={{ fontSize: '12px' }}>
          <RefreshCw size={14} /> Refresh Spark Data
        </button>
      </div>

      {/* KPI Summary Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>ACTIVE FLIGHTS NOW</div>
          <div className="font-mono-hud" style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
            {realtimeMetrics.activeFlights}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>SPARK PROCESSED ROWS</div>
          <div className="font-mono-hud" style={{ fontSize: '24px', fontWeight: '700', color: '#38bdf8' }}>
            {realtimeMetrics.redshiftProcessedEvents.toLocaleString()}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>S3 DATA LAKE STORED</div>
          <div className="font-mono-hud" style={{ fontSize: '24px', fontWeight: '700', color: '#ff9900' }}>
            {realtimeMetrics.s3ParquetStoredMB} MB
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>EMERGENCY / ALERTS COUNT</div>
          <div className="font-mono-hud" style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
            {realtimeMetrics.totalAlerts}
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

        {/* Chart 1: Hourly Active Flight Density */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
            Hourly Flight Traffic & Stream Ingestion Volume
          </h3>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={redshiftData.hourlyFlightDensity}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="hour" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #10b981', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="activeFlights" stroke="#10b981" fill="rgba(16, 185, 129, 0.2)" name="Active Aircraft" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Altitude Band Distribution */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
            Altitude Flight Band Distribution
          </h3>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={redshiftData.altitudeBandDistribution}
                  dataKey="count"
                  nameKey="band"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={50}
                  label
                >
                  {redshiftData.altitudeBandDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #38bdf8', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Top International Route Performance */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
            Top Air Corridor Flight Volume & On-Time Performance %
          </h3>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={redshiftData.routePerformanceStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="route" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #a855f7', borderRadius: '8px' }} />
                <Bar dataKey="flightsCount" fill="#a855f7" radius={[4, 4, 0, 0]} name="Flights Count" />
                <Bar dataKey="onTimePct" fill="#06b6d4" radius={[4, 4, 0, 0]} name="On-Time %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Flight Delay Factors */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
            Flight Delay Factors & Impact (Minutes)
          </h3>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={redshiftData.delayFactorAnalysis} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                <YAxis dataKey="factor" type="category" stroke="#9ca3af" fontSize={11} width={140} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #f59e0b', borderRadius: '8px' }} />
                <Bar dataKey="impactMinutes" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Avg Delay (Mins)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
