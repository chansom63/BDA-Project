import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, Mail, MessageSquare, Bell, RefreshCw } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export default function AlertCenter() {
  const { liveAlerts } = useSocket();
  const { token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [notificationLogs, setNotificationLogs] = useState({ sesEmails: [], snsMessages: [] });
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
        if (data.notificationLogs) setNotificationLogs(data.notificationLogs);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [liveAlerts]);

  const acknowledgeAlert = async (alertId) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        fetchAlerts();
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>Airspace Alert & Incident Management</h2>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>Real-time rule engine breaches: Proximity distance &lt; 10 NM and emergency squawks (7700, 7600, 7500)</p>
        </div>

        <button className="btn-secondary" onClick={fetchAlerts} style={{ fontSize: '12px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Alert Log
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* Left: Active Alerts Stream */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#ef4444" />
            Active Alert Incidents ({alerts.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {alerts.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                <CheckCircle size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                <div>All airspace traffic normal. No active proximity breaches or emergency squawks.</div>
              </div>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.alertId}
                  className={alert.severity === 'EMERGENCY' ? 'glass-panel emergency-pulse' : 'glass-panel'}
                  style={{
                    padding: '16px',
                    borderColor: alert.severity === 'EMERGENCY' ? '#ef4444' : '#f59e0b',
                    background: alert.severity === 'EMERGENCY' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-card)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          background: alert.severity === 'EMERGENCY' ? '#ef4444' : '#f59e0b',
                          color: '#fff',
                          fontWeight: '700',
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {alert.severity} • {alert.type}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{alert.callsign}</span>
                        {alert.secondaryCallsign && (
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8' }}> ↔ {alert.secondaryCallsign}</span>
                        )}
                      </div>

                      <p style={{ fontSize: '13px', color: '#e5e7eb', margin: '6px 0' }}>{alert.message}</p>

                      <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '12px' }}>
                        <span>TIME: {new Date(alert.createdAt).toLocaleTimeString()}</span>
                        {alert.distanceNM && <span>DISTANCE: {alert.distanceNM} NM</span>}
                        {alert.acknowledged && <span style={{ color: '#10b981', fontWeight: '600' }}>ACKNOWLEDGED BY: {alert.acknowledgedBy}</span>}
                      </div>
                    </div>

                    <div>
                      {!alert.acknowledged ? (
                        <button
                          className="btn-primary"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                          onClick={() => acknowledgeAlert(alert.alertId)}
                        >
                          Acknowledge & Clear
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={14} /> Resolved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: AWS SES Email & SNS SMS Dispatch Logs */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={18} color="#ff9900" />
            Kafka Event Dispatch Logs
          </h3>

          <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#ff9900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} /> SMTP Alert Dispatch (Email Notifications)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {notificationLogs.sesEmails.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>No emails dispatched yet.</div>
              ) : (
                notificationLogs.sesEmails.map(log => (
                  <div key={log.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', fontSize: '11px' }}>
                    <div style={{ fontWeight: '600', color: '#fff' }}>To: {log.recipient}</div>
                    <div style={{ color: '#9ca3af' }}>{log.subject}</div>
                    <div style={{ color: '#10b981', marginTop: '2px' }}>STATUS: {log.status}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#a855f7', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={14} /> Twilio Alert Dispatch (SMS / Push Alerts)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {notificationLogs.snsMessages.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>No SMS messages sent yet.</div>
              ) : (
                notificationLogs.snsMessages.map(log => (
                  <div key={log.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', fontSize: '11px' }}>
                    <div style={{ fontWeight: '600', color: '#fff' }}>To: {log.phoneNumber}</div>
                    <div style={{ color: '#9ca3af' }}>{log.message}</div>
                    <div style={{ color: '#10b981', marginTop: '2px' }}>STATUS: {log.status}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
