import React, { useState, useEffect } from 'react';
import { Layers, Database, Cpu, Cloud, Activity, Play, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AwsPipelineVisualizer() {
  const { token } = useAuth();
  const [pipelineData, setPipelineData] = useState(null);
  const [etlRunning, setEtlRunning] = useState(false);
  const [etlMessage, setEtlMessage] = useState('');

  const fetchPipelineStatus = async () => {
    try {
      const res = await fetch('/api/analytics/dashboard');
      const data = await res.json();
      if (data.success) {
        setPipelineData(data);
      }
    } catch (err) {
      console.error('Error fetching Docker pipeline info:', err);
    }
  };

  useEffect(() => {
    fetchPipelineStatus();
    const interval = setInterval(fetchPipelineStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerGlueEtl = async () => {
    setEtlRunning(true);
    setEtlMessage('Running Hadoop MapReduce Batch ETL...');
    try {
      const res = await fetch('/api/etl/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setEtlMessage(`Spark Job Executed in ${data.jobResult.executionTimeSec}s! ${data.jobResult.recordsTransformed} records transformed into the Analytical Warehouse.`);
        fetchPipelineStatus();
      }
    } catch (err) {
      setEtlMessage('Spark ETL execution failed.');
    } finally {
      setEtlRunning(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Title & Manual ETL Trigger */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff' }}>Dockerized Data Analytics Architecture Pipeline</h2>
            <span style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.4)', fontSize: '11px', fontWeight: '700', padding: '2px 10px', borderRadius: '12px' }}>
              DOCKERIZED SERVICES
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>Live interactive flow of real-time ADS-B telemetry across the Docker Big Data Analytics stack</p>
        </div>

        <button
          className="btn-primary"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)' }}
          onClick={triggerGlueEtl}
          disabled={etlRunning}
        >
          <Play size={16} className={etlRunning ? 'spin' : ''} />
          {etlRunning ? 'Executing MapReduce ETL...' : 'Trigger Hadoop MapReduce Batch ETL'}
        </button>
      </div>

      {etlMessage && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '20px', borderColor: '#a855f7', color: '#e9d5ff', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} color="#a855f7" />
          {etlMessage}
        </div>
      )}

      {/* Main Architecture Flow Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Step 1: Ingestion & Telemetry Source */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <Activity size={20} color="#10b981" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>1. REAL-TIME STREAM INGESTION LAYER</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#10b981' }}>Flight ADS-B Transponders</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0' }}>Simulated ADS-B Telemetry Stream (ICAO, Altitude, Lat/Lon, Squawk)</div>
              <div className="font-mono-hud" style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                {pipelineData?.realtimeMetrics?.activeFlights || 12} Aircraft Transmitting
              </div>
            </div>

            <div style={{ background: 'rgba(255, 153, 0, 0.08)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255, 153, 0, 0.3)' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#ff9900' }}>Apache Kafka Broker (Docker Container)</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0' }}>Durable, scalable event streaming topic: raw-adsb-telemetry-feed</div>
              <div className="font-mono-hud" style={{ fontSize: '14px', fontWeight: '700', color: '#ff9900' }}>
                6 Partitions • 120 msg/sec
              </div>
            </div>

            <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#06b6d4' }}>Node.js Stream Processor</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0' }}>Real-time stream processing, proximity rule evaluation & windowed aggregations</div>
              <div className="font-mono-hud" style={{ fontSize: '14px', fontWeight: '700', color: '#06b6d4' }}>
                4 Shards ACTIVE
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Storage & Operational Database */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <Database size={20} color="#06b6d4" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>2. OPERATIONAL DATABASE & HISTORICAL DATA LAKE</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#10b981' }}>MongoDB (Docker Container)</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0' }}>Operational state store for current aircraft positions, alerts, and user profiles</div>
              <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginTop: '8px' }}>
                {pipelineData?.realtimeMetrics?.activeFlights || 0} Live Docs • {pipelineData?.realtimeMetrics?.totalAlerts || 0} Alerts Stored
              </div>
            </div>

            <div style={{ background: 'rgba(255, 153, 0, 0.08)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 153, 0, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#ff9900' }}>Hadoop HDFS Data Lake</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0' }}>Raw telemetry partition structure: /data/telemetry/year=YYYY/month=MM/day=DD/hour=HH (JSON/HDFS)</div>
              <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: '#ff9900', marginTop: '8px' }}>
                {pipelineData?.realtimeMetrics?.s3ObjectsCount || 0} Objects • {pipelineData?.realtimeMetrics?.s3ParquetStoredMB || 0} MB Stored
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Batch Processing & Data Warehouse */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <Cpu size={20} color="#a855f7" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>3. BATCH ETL & ANALYTICS DATA WAREHOUSE</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#a855f7' }}>Hadoop MapReduce Batch ETL</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0' }}>Automated batch transform, computing heavy historical aggregations over HDFS</div>
              <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginTop: '8px' }}>
                Catalog Database: flight_telemetry_catalog • Status: READY
              </div>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8' }}>Apache Hive Data Warehouse</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0' }}>High performance OLAP analytical database for route statistics & delay analysis</div>
              <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: '#38bdf8', marginTop: '8px' }}>
                {pipelineData?.realtimeMetrics?.redshiftProcessedEvents?.toLocaleString() || 145200} Rows Queryable
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
