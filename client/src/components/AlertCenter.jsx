import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, Mail, MessageSquare, RefreshCw, CheckCheck, Plane } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export default function AlertCenter() {
  const { liveFlights } = useSocket();
  const { token } = useAuth();
  const [notificationLogs, setNotificationLogs] = useState({ sesEmails: [], snsMessages: [] });
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      if (data.success && data.notificationLogs) {
        setNotificationLogs(data.notificationLogs);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const resetFlightSquawk = async (flightId) => {
    try {
      const res = await fetch(`/api/flights/${flightId}/squawk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ squawkCode: '1200' })
      });
      await res.json();
      fetchLogs();
    } catch (err) {
      console.error('Error resetting squawk code:', err);
    }
  };

  // Derive emergency flights currently active on the live radar map
  const emergencyFlightsOnMap = (liveFlights || []).filter(
    f => f.status === 'Emergency' || ['7700', '7600', '7500'].includes(f.squawk)
  );

  const emergencyLabels = {
    '7700': 'GENERAL EMERGENCY DECLARATION (MAYDAY)',
    '7600': 'RADIO COMMUNICATIONS FAILURE',
    '7500': 'UNLAWFUL INTERFERENCE / HIJACK WARNING'
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={22} color="#ef4444" />
            Live Emergency Incident Center
          </h2>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>
            Active emergency squawks detected on the live map (7700 MAYDAY, 7600 COMMS LOSS, 7500 HIJACK)
          </p>
        </div>

        <button className="btn-secondary" onClick={fetchLogs} style={{ fontSize: '12px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Dispatch Logs
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* Left: Active Emergency Flights Stream (Synchronized with Map) */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} color="#ef4444" />
            Live Map Emergency Aircraft ({emergencyFlightsOnMap.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {emergencyFlightsOnMap.length === 0 ? (
              <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                <CheckCircle size={36} color="#10b981" style={{ marginBottom: '10px' }} />
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>All Airspace Traffic Normal</div>
                <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>No active emergency squawks on the flight radar map.</div>
              </div>
            ) : (
              emergencyFlightsOnMap.map(flight => {
                const lat = flight.latitude ?? flight.currentPosition?.lat ?? 0;
                const lon = flight.longitude ?? flight.currentPosition?.lon ?? 0;
                const alt = flight.altitudeFt ?? flight.currentPosition?.altitudeFt ?? 0;
                const speed = flight.speedKnots ?? flight.currentPosition?.speedKnots ?? 0;
                const label = emergencyLabels[flight.squawk] || 'EMERGENCY SQUAWK';

                return (
                  <div
                    key={flight.flightId}
                    className="glass-panel emergency-pulse"
                    style={{
                      padding: '16px',
                      borderColor: '#ef4444',
                      background: 'rgba(239, 68, 68, 0.12)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{
                            background: '#ef4444',
                            color: '#fff',
                            fontWeight: '800',
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            SQUAWK {flight.squawk}
                          </span>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>{flight.callsign}</span>
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>({flight.airline} • {flight.aircraftType})</span>
                        </div>

                        <p style={{ fontSize: '13px', color: '#fca5a5', margin: '6px 0', fontWeight: '700' }}>
                          EMERGENCY SQUAWK {flight.squawk}: {label}
                        </p>

                        <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '16px', marginTop: '8px' }}>
                          <span>ROUTE: <strong style={{ color: '#00b4d8' }}>{flight.origin?.code} ➔ {flight.destination?.code}</strong></span>
                          <span>ALT: <strong style={{ color: '#fff' }}>FL{Math.round(alt / 100)} ({Math.round(alt)} FT)</strong></span>
                          <span>SPEED: <strong style={{ color: '#fff' }}>{speed} kts</strong></span>
                          <span>LAT/LON: <strong style={{ color: '#fff' }}>{lat.toFixed(2)}°, {lon.toFixed(2)}°</strong></span>
                        </div>
                      </div>

                      <div>
                        <button
                          className="btn-fr24-yellow"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                          onClick={() => resetFlightSquawk(flight.flightId)}
                        >
                          Clear Emergency (Reset 1200)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Emergency Dispatch Logs (Amazon SES / Twilio) */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={18} color="#ff9900" />
            Emergency Dispatch Logs
          </h3>

          <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#ff9900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} /> SMTP Emergency Alert Dispatch (Email)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {notificationLogs.sesEmails.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>No emergency emails dispatched.</div>
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
              <MessageSquare size={14} /> Twilio Emergency SMS Dispatch
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {notificationLogs.snsMessages.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>No emergency SMS sent.</div>
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
