import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { BarChart3, RefreshCw } from 'lucide-react';

const COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#a855f7', '#38bdf8'];

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/analytics/dashboard');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 15 seconds
    const timer = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(timer);
  }, []);

  if (loading || !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
        <RefreshCw size={32} style={{ marginBottom: '12px', color: '#10b981' }} />
        <div>Loading ClickHouse analytics…</div>
      </div>
    );
  }

  const { realtimeMetrics, analyticsData } = data;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff' }}>
              Flight Telemetry Analytics Dashboard
            </h2>
            <span style={{
              background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              fontSize: '11px', fontWeight: '700', padding: '2px 10px', borderRadius: '12px'
            }}>
              CLICKHOUSE
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>
            Real-time flight statistics — Kafka → Spark → Kafka → ClickHouse pipeline
          </p>
        </div>
        <button className="btn-secondary" onClick={fetchDashboardData} style={{ fontSize: '12px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>ACTIVE FLIGHTS (5 min)</div>
          <div className="font-mono-hud" style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>
            {realtimeMetrics?.activeFlights ?? '—'}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>TOTAL PROCESSED EVENTS</div>
          <div className="font-mono-hud" style={{ fontSize: '28px', fontWeight: '700', color: '#38bdf8' }}>
            {(realtimeMetrics?.totalProcessedEvents ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>ANOMALIES DETECTED</div>
          <div className="font-mono-hud" style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444' }}>
            {realtimeMetrics?.totalAlerts ?? '—'}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Chart 1: Hourly Flight Traffic */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
            Hourly Flight Traffic &amp; Ingestion Volume
          </h3>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData?.hourlyFlightDensity || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="hour" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #10b981', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="activeFlights" stroke="#10b981" fill="rgba(16,185,129,0.2)" name="Active Aircraft" />
                <Area type="monotone" dataKey="ingestedEvents"  stroke="#38bdf8" fill="rgba(56,189,248,0.1)"  name="Ingested Events" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Altitude Band Distribution */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
            Altitude Band Distribution
          </h3>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData?.altitudeBandDistribution || []}
                  dataKey="count"
                  nameKey="band"
                  cx="50%" cy="50%"
                  outerRadius={85} innerRadius={50}
                  label={({ band, percentage }) => `${percentage}%`}
                >
                  {(analyticsData?.altitudeBandDistribution || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #38bdf8', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Top Routes by Flight Count */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
            Top Air Corridors by Flight Count
          </h3>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData?.routePerformanceStats || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="route" stroke="#9ca3af" fontSize={10} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #a855f7', borderRadius: '8px' }} />
                <Bar dataKey="flightsCount"   fill="#a855f7" radius={[4,4,0,0]} name="Flights" />
                <Bar dataKey="avgSpeedKnots"  fill="#06b6d4" radius={[4,4,0,0]} name="Avg Speed (kts)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary stats table */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
            Pipeline Data Status
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <tbody>
              {[
                { label: 'ClickHouse status',  value: data.status?.clickhouse || '—' },
                { label: 'Kafka',               value: data.status?.kafka      || '—' },
                { label: 'Spark Streaming',     value: data.status?.sparkStreaming || '—' },
                { label: 'Active flights',      value: realtimeMetrics?.activeFlights ?? '—' },
                { label: 'Total events',        value: (realtimeMetrics?.totalProcessedEvents ?? 0).toLocaleString() },
                { label: 'Total anomalies',     value: realtimeMetrics?.totalAlerts ?? '—' },
              ].map(({ label, value }) => (
                <tr key={label} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '10px 8px', color: '#9ca3af' }}>{label}</td>
                  <td style={{ padding: '10px 8px', color: '#fff', fontWeight: '600', textAlign: 'right' }}>
                    {String(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
