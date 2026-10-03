import React from 'react';
import { X, Plane, Navigation, Wind, ShieldAlert, AlertCircle, ArrowUpRight, ArrowDownRight, Radio } from 'lucide-react';
import { formatAltitude, getAltitudeColor, getSquawkBadge } from '../utils/geoUtils';

export default function FlightDrawer({ flight, onClose, onTriggerSquawk }) {
  if (!flight) return null;

  const lat = flight.currentPosition?.lat || flight.lat;
  const lon = flight.currentPosition?.lon || flight.lon;
  const alt = flight.currentPosition?.altitudeFt || flight.altitudeFt || 30000;
  const speed = flight.currentPosition?.speedKnots || flight.speedKnots || 450;
  const heading = flight.currentPosition?.headingDeg || flight.headingDeg || 0;
  const vrate = flight.currentPosition?.verticalRateFpm || flight.verticalRateFpm || 0;
  const squawk = flight.squawk || '1200';
  const squawkBadge = getSquawkBadge(squawk);

  return (
    <div className="glass-panel-glow" style={{
      position: 'absolute',
      top: '80px',
      right: '24px',
      width: '380px',
      maxHeight: 'calc(100vh - 120px)',
      zIndex: 600,
      padding: '20px',
      overflowY: 'auto',
      animation: 'fadeIn 0.3s ease-in-out'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '8px', borderRadius: '8px' }}>
            <Plane size={20} color="#10b981" />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>{flight.callsign}</h3>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{flight.airline} ({flight.aircraftType})</span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Emergency Squawk Badge */}
      <div style={{
        background: squawkBadge.isEmergency ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
        border: `1px solid ${squawkBadge.color}`,
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={16} color={squawkBadge.color} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: squawkBadge.color }}>{squawkBadge.label}</span>
        </div>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>STATUS: {flight.status}</span>
      </div>

      {/* Flight Route Progress */}
      <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#38bdf8' }}>{flight.origin?.code}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{flight.origin?.city}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', marginBottom: '2px' }}>{flight.progressPct}% FLOWN</div>
            <div style={{ width: '100%', height: '4px', background: '#374151', borderRadius: '2px', position: 'relative' }}>
              <div style={{ width: `${flight.progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #06b6d4)', borderRadius: '2px' }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#38bdf8' }}>{flight.destination?.code}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{flight.destination?.city}</div>
          </div>
        </div>
      </div>

      {/* Telemetry Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>ALTITUDE</div>
          <div className="font-mono-hud" style={{ fontSize: '16px', fontWeight: '700', color: getAltitudeColor(alt) }}>
            {formatAltitude(alt)}
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>GROUND SPEED</div>
          <div className="font-mono-hud" style={{ fontSize: '16px', fontWeight: '700', color: '#38bdf8' }}>
            {speed} kts
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>HEADING</div>
          <div className="font-mono-hud" style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>
            {heading}°
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>VERTICAL RATE</div>
          <div className="font-mono-hud" style={{ fontSize: '16px', fontWeight: '700', color: vrate < 0 ? '#ef4444' : vrate > 0 ? '#10b981' : '#9ca3af' }}>
            {vrate > 0 ? `+${vrate}` : vrate} fpm
          </div>
        </div>
      </div>

      {/* Position Coordinates */}
      <div className="font-mono-hud" style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', color: '#9ca3af', marginBottom: '16px' }}>
        LAT: {lat ? lat.toFixed(4) : 'N/A'}° | LON: {lon ? lon.toFixed(4) : 'N/A'}° | ICAO: {flight.icao24}
      </div>

      {/* Emergency Control Trigger Actions */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', marginBottom: '8px' }}>TELEMETRY CONTROLS</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {squawk !== '7700' ? (
            <button
              className="btn-danger"
              style={{ width: '100%', fontSize: '12px', justifyContent: 'center' }}
              onClick={() => onTriggerSquawk(flight.flightId, '7700')}
            >
              <ShieldAlert size={14} />
              Declare MAYDAY (7700)
            </button>
          ) : (
            <button
              className="btn-primary"
              style={{ width: '100%', fontSize: '12px', justifyContent: 'center' }}
              onClick={() => onTriggerSquawk(flight.flightId, '1200')}
            >
              Clear Emergency (Squawk 1200)
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
