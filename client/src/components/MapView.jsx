import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Plane, AlertTriangle, Wind, Navigation, ShieldAlert, Activity } from 'lucide-react';
import { formatAltitude, getAltitudeColor, getSquawkBadge } from '../utils/geoUtils';

// Helper to construct rotated SVG aircraft icon for Leaflet
function createAircraftIcon(headingDeg, squawk, altitudeFt, isSelected) {
  const isEmergency = ['7700', '7600', '7500'].includes(squawk);
  const strokeColor = isEmergency ? '#ef4444' : isSelected ? '#38bdf8' : getAltitudeColor(altitudeFt);
  const fillColor = isEmergency ? 'rgba(239, 68, 68, 0.6)' : isSelected ? 'rgba(56, 189, 248, 0.4)' : 'rgba(16, 185, 129, 0.3)';

  const svgHtml = `
    <div style="transform: rotate(${headingDeg}deg); transition: transform 0.4s ease-out; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.5-.1-.9.1-1.1.5l-.8 1.4c-.2.4-.1.9.3 1.2l4.8 3.5-3.2 3.2-2.3-.6c-.4-.1-.8.1-1 .5l-.4.7c-.2.4-.1.8.2 1.1l2.4 2.4c.3.3.7.4 1.1.2l.7-.4c.4-.2.6-.6.5-1l-.6-2.3 3.2-3.2 3.5 4.8c.3.4.8.5 1.2.3l1.4-.8c.4-.2.6-.6.5-1.1z"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: isEmergency ? 'plane-marker-icon emergency' : 'plane-marker-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
}

export default function MapView({ flights, selectedFlight, setSelectedFlight, onTriggerEmergency }) {
  const [mapZoom] = useState(4);
  const [mapCenter] = useState([42.0, -40.0]); // Atlantic Aviation View
  const [showTrails, setShowTrails] = useState(true);
  const [showRadarSweep, setShowRadarSweep] = useState(true);

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 72px)', overflow: 'hidden' }}>
      
      {/* Radar Sweep Overlay Effect */}
      {showRadarSweep && (
        <div className="radar-sweep-container" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zindex: 450 }}>
          <div className="radar-sweep-line" />
        </div>
      )}

      {/* Map Control HUD Overlay */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity size={18} color="#10b981" />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>LIVE RADAR STREAM</span>
          <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '10px' }}>
            {flights.length} Aircraft Active
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '8px 12px', display: 'flex', gap: '10px' }}>
          <button
            className={showTrails ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setShowTrails(!showTrails)}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            {showTrails ? 'Hide Trajectories' : 'Show Trajectories'}
          </button>
          <button
            className={showRadarSweep ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setShowRadarSweep(!showRadarSweep)}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            {showRadarSweep ? 'Hide Sweep' : 'Show Sweep'}
          </button>
        </div>
      </div>

      {/* Altitude Legend HUD */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '16px',
        zIndex: 500
      }}>
        <div className="glass-panel" style={{ padding: '10px 14px', fontSize: '11px' }}>
          <div style={{ fontWeight: '600', color: '#9ca3af', marginBottom: '6px' }}>ALTITUDE SCALE</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#a855f7', borderRadius: '2px' }}/> FL380+</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#06b6d4', borderRadius: '2px' }}/> FL300-370</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }}/> FL200-290</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px' }}/> FL100-190</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }}/> &lt;FL100 / EMG</div>
          </div>
        </div>
      </div>

      {/* Leaflet MapContainer */}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Dark Matter Map Tile Layer */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
          maxZoom={19}
        />

        {/* Flight Markers & Trajectories */}
        {flights.map(flight => {
          const lat = flight.currentPosition?.lat || flight.lat;
          const lon = flight.currentPosition?.lon || flight.lon;
          const alt = flight.currentPosition?.altitudeFt || flight.altitudeFt || 30000;
          const heading = flight.currentPosition?.headingDeg || flight.headingDeg || 0;
          const speed = flight.currentPosition?.speedKnots || flight.speedKnots || 450;
          const squawk = flight.squawk || '1200';
          const isSelected = selectedFlight?.flightId === flight.flightId;
          const squawkBadge = getSquawkBadge(squawk);

          const icon = createAircraftIcon(heading, squawk, alt, isSelected);

          // Flight trajectory line points
          const trajectoryPoints = (flight.trajectory || []).map(t => [t.lat, t.lon]);
          if (trajectoryPoints.length > 0 && lat && lon) {
            trajectoryPoints.push([lat, lon]);
          }

          return (
            <React.Fragment key={flight.flightId}>
              {/* Draw Flight Trajectory Polyline */}
              {showTrails && trajectoryPoints.length > 1 && (
                <Polyline
                  positions={trajectoryPoints}
                  color={squawkBadge.isEmergency ? '#ef4444' : isSelected ? '#38bdf8' : getAltitudeColor(alt)}
                  weight={isSelected ? 3 : 2}
                  dashArray={isSelected ? null : '4, 4'}
                  opacity={0.7}
                />
              )}

              {/* Draw Emergency Radius Circle for 7700 squawks */}
              {squawkBadge.isEmergency && lat && lon && (
                <Circle
                  center={[lat, lon]}
                  radius={50000} // 50 km emergency clearance circle
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 1 }}
                />
              )}

              {/* Aircraft Marker */}
              {lat && lon && (
                <Marker
                  position={[lat, lon]}
                  icon={icon}
                  eventHandlers={{
                    click: () => setSelectedFlight(flight)
                  }}
                >
                  <Popup>
                    <div style={{ padding: '6px', minWidth: '180px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '700', fontSize: '15px', color: '#10b981' }}>{flight.callsign}</span>
                        <span style={{
                          background: squawkBadge.isEmergency ? '#ef4444' : 'rgba(16, 185, 129, 0.2)',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {squawkBadge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>{flight.airline} ({flight.aircraftType})</div>
                      <div style={{ fontSize: '12px', margin: '4px 0', color: '#e5e7eb' }}>
                        {flight.origin?.code} ➔ {flight.destination?.code} ({flight.progressPct}% done)
                      </div>
                      <div className="font-mono-hud" style={{ fontSize: '12px', color: '#38bdf8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px' }}>
                        <div>ALT: {formatAltitude(alt)}</div>
                        <div>SPD: {speed} kts</div>
                        <div>HDG: {heading}°</div>
                        <div>STATUS: {flight.status}</div>
                      </div>
                      <button
                        className="btn-primary"
                        style={{ width: '100%', marginTop: '8px', fontSize: '11px', justifyContent: 'center' }}
                        onClick={() => setSelectedFlight(flight)}
                      >
                        Inspect HUD Telemetry
                      </button>
                    </div>
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
