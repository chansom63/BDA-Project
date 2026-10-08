import React, { useState } from 'react';
import { X, Plane, Navigation, Wind, ShieldAlert, Radio, Eye, Camera, Clock, Crosshair, Compass, Zap } from 'lucide-react';
import { formatAltitude, getAltitudeColor, getSquawkBadge } from '../utils/geoUtils';

export default function FlightDrawer({ flight, onClose, onTriggerSquawk, onFollowFlight }) {
  const [show3DHud, setShow3DHud] = useState(false);
  const [following, setFollowing] = useState(false);

  if (!flight) return null;

  const lat = flight.currentPosition?.lat || flight.lat;
  const lon = flight.currentPosition?.lon || flight.lon;
  const alt = flight.currentPosition?.altitudeFt || flight.altitudeFt || 30000;
  const speed = flight.currentPosition?.speedKnots || flight.speedKnots || 450;
  const heading = flight.currentPosition?.headingDeg || flight.headingDeg || 0;
  const vrate = flight.currentPosition?.verticalRateFpm || flight.verticalRateFpm || 0;
  const squawk = flight.squawk || '1200';
  const squawkBadge = getSquawkBadge(squawk);

  const toggleFollow = () => {
    setFollowing(!following);
    if (onFollowFlight) onFollowFlight(flight, !following);
  };

  return (
    <aside className="fr24-drawer">

      {/* FR24 Header */}
      <div style={{ background: '#111722', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--fr24-panel-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>{flight.countryFlag || '✈️'}</span>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#facc15', letterSpacing: '-0.02em' }}>
              {flight.callsign} <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '400' }}>({flight.flightId})</span>
            </div>
            <div style={{ fontSize: '12px', color: '#d1d5db', fontWeight: '500' }}>
              {flight.airline}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#9ca3af', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Aircraft Photo Card */}
      <div style={{ position: 'relative', width: '100%', height: '180px', overflow: 'hidden', background: '#090d16' }}>
        <img
          src={flight.photoUrl || 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&auto=format&fit=crop&q=80'}
          alt={flight.aircraftType}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(22,29,42,1) 0%, transparent 60%)' }} />

        <div style={{ position: 'absolute', bottom: '10px', left: '14px', right: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{flight.aircraftType}</div>
            <div style={{ fontSize: '11px', color: '#facc15', fontWeight: '600' }}>REG: {flight.registration || 'N800AN'} • ICAO: {flight.icao24}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Camera size={11} /> JetPhotos
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>


        {/* Flight Route Infographic Box (Flightradar24 Style) */}
        <div style={{ background: '#111722', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px solid var(--fr24-panel-border)' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            {/* Origin */}
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff', letterSpacing: '-0.02em' }}>{flight.origin?.code}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{flight.origin?.city} ({flight.origin?.icao})</div>
            </div>

            {/* Flight Path Graphic */}
            <div style={{ textAlign: 'center', flex: 1.5, padding: '0 8px' }}>
              <div style={{ fontSize: '11px', color: '#facc15', fontWeight: '700', marginBottom: '4px' }}>{flight.progressPct}% COMPLETED</div>
              <div style={{ position: 'relative', width: '100%', height: '4px', background: '#222d40', borderRadius: '2px' }}>
                <div style={{ width: `${flight.progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #facc15, #00b4d8)', borderRadius: '2px' }} />
                <div style={{
                  position: 'absolute',
                  top: '-6px',
                  left: `${flight.progressPct}%`,
                  transform: 'translateX(-50%)',
                  background: '#facc15',
                  padding: '2px',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px #facc15'
                }}>
                  <Plane size={10} color="#000" style={{ transform: 'rotate(90deg)' }} />
                </div>
              </div>
            </div>

            {/* Destination */}
            <div style={{ textAlign: 'right', flex: 1 }}>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff', letterSpacing: '-0.02em' }}>{flight.destination?.code}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{flight.destination?.city} ({flight.destination?.icao})</div>
            </div>
          </div>

          {/* Schedule Times Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>
            <div>
              <span style={{ color: '#9ca3af' }}>STD: </span>
              <span style={{ color: '#fff', fontWeight: '600' }}>{flight.std || '19:30 UTC'}</span>
              <span style={{ color: '#10b981', marginLeft: '6px' }}>(ATD {flight.atd || '19:42'})</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#9ca3af' }}>STA: </span>
              <span style={{ color: '#fff', fontWeight: '600' }}>{flight.sta || '07:30 UTC'}</span>
              <span style={{ color: '#00b4d8', marginLeft: '6px' }}>(ETA {flight.eta || '07:18'})</span>
            </div>
          </div>

        </div>

        {/* Action Toolbar (Follow, 3D Cockpit HUD, Emergency) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <button
            className={following ? 'btn-fr24-yellow' : 'btn-secondary'}
            onClick={toggleFollow}
            style={{ fontSize: '12px', justifyContent: 'center' }}
          >
            <Crosshair size={14} /> {following ? 'Tracking Aircraft' : 'Follow Flight'}
          </button>

          <button
            className={show3DHud ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setShow3DHud(!show3DHud)}
            style={{ fontSize: '12px', justifyContent: 'center' }}
          >
            <Eye size={14} /> {show3DHud ? 'Hide 3D Cockpit' : '3D Cockpit HUD'}
          </button>
        </div>

        {/* 3D Horizon Cockpit HUD View Simulator Overlay */}
        {show3DHud && (
          <div style={{ background: '#090d16', border: '1px solid var(--fr24-cyan)', borderRadius: '10px', padding: '14px', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#00b4d8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} /> 3D ARTIFICIAL HORIZON COCKPIT HUD
            </div>

            {/* Horizon Graphic */}
            <div style={{ width: '100%', height: '120px', background: 'linear-gradient(180deg, #1e3a8a 0%, #00b4d8 50%, #78350f 50%, #451a03 100%)', borderRadius: '6px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Pitch & Crosshair Lines */}
              <div style={{ width: '80%', height: '1px', background: '#facc15', position: 'absolute' }} />
              <div style={{ width: '1px', height: '60%', background: 'rgba(255,255,255,0.4)', position: 'absolute' }} />

              {/* Aircraft Horizon Wings */}
              <div style={{ width: '40px', height: '4px', background: '#facc15', border: '1px solid #000', borderRadius: '2px', position: 'relative', zIndex: 10 }} />

              {/* HUD Monospace Metrics Overlay */}
              <div className="font-mono-hud" style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '10px', color: '#10b981', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '3px' }}>
                SPD: {speed} KTS
              </div>
              <div className="font-mono-hud" style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', color: '#00b4d8', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '3px' }}>
                ALT: {formatAltitude(alt)}
              </div>
              <div className="font-mono-hud" style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#facc15', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '3px' }}>
                HDG: {heading}°
              </div>
            </div>
          </div>
        )}

        {/* Telemetry Data Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <div style={{ background: '#111722', padding: '10px', borderRadius: '8px', border: '1px solid var(--fr24-panel-border)' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase' }}>Calibrated Altitude</div>
            <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: getAltitudeColor(alt) }}>
              {formatAltitude(alt)} <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>({Math.round(alt * 0.3048)} m)</span>
            </div>
          </div>

          <div style={{ background: '#111722', padding: '10px', borderRadius: '8px', border: '1px solid var(--fr24-panel-border)' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase' }}>Ground Speed</div>
            <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: '#00b4d8' }}>
              {speed} kts <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>({Math.round(speed * 1.852)} km/h)</span>
            </div>
          </div>

          <div style={{ background: '#111722', padding: '10px', borderRadius: '8px', border: '1px solid var(--fr24-panel-border)' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase' }}>Track Heading</div>
            <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: '#facc15' }}>
              {heading}°
            </div>
          </div>

          <div style={{ background: '#111722', padding: '10px', borderRadius: '8px', border: '1px solid var(--fr24-panel-border)' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase' }}>Vertical Speed</div>
            <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: vrate < 0 ? '#ef4444' : vrate > 0 ? '#10b981' : '#9ca3af' }}>
              {vrate > 0 ? `+${vrate}` : vrate} fpm
            </div>
          </div>
        </div>

        {/* Position & ADS-B Metadata Footer */}
        <div style={{ background: '#111722', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--fr24-panel-border)', fontSize: '11px', color: '#9ca3af', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>LAT / LON:</span>
            <span className="font-mono-hud" style={{ color: '#fff' }}>{lat ? lat.toFixed(4) : 0}°, {lon ? lon.toFixed(4) : 0}°</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>TRANSPONDER SQUAWK:</span>
            <span className="font-mono-hud" style={{ color: squawkBadge.isEmergency ? '#ef4444' : '#10b981', fontWeight: '700' }}>{squawkBadge.label}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>RADAR FEED SOURCE:</span>
            <span className="font-mono-hud" style={{ color: '#00b4d8' }}>{flight.radarSource || 'F-KJFK1'} (ADS-B)</span>
          </div>
        </div>


      </div>

    </aside>
  );
}
