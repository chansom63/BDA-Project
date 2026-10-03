import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Plane, AlertTriangle, Wind, Navigation, ShieldAlert, Activity, Layers, MapPin } from 'lucide-react';
import { formatAltitude, getAltitudeColor, getSquawkBadge } from '../utils/geoUtils';

// Helper to construct Flightradar24 rotated yellow plane icon
function createFR24PlaneIcon(headingDeg, squawk, altitudeFt, isSelected) {
  const isEmergency = ['7700', '7600', '7500'].includes(squawk);
  
  // Signature Flightradar24 colors: Yellow (#facc15) standard, Cyan (#00b4d8) selected, Red (#ef4444) emergency
  const strokeColor = isEmergency ? '#ef4444' : isSelected ? '#00b4d8' : '#000000';
  const fillColor = isEmergency ? '#ef4444' : isSelected ? '#00b4d8' : '#facc15';

  const svgHtml = `
    <div style="transform: rotate(${headingDeg}deg); transition: transform 0.4s ease-out; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.5-.1-.9.1-1.1.5l-.8 1.4c-.2.4-.1.9.3 1.2l4.8 3.5-3.2 3.2-2.3-.6c-.4-.1-.8.1-1 .5l-.4.7c-.2.4-.1.8.2 1.1l2.4 2.4c.3.3.7.4 1.1.2l.7-.4c.4-.2.6-.6.5-1l-.6-2.3 3.2-3.2 3.5 4.8c.3.4.8.5 1.2.3l1.4-.8c.4-.2.6-.6.5-1.1z"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: isEmergency ? 'fr24-marker-icon emergency' : isSelected ? 'fr24-marker-icon selected' : 'fr24-marker-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
  });
}

// Custom Airport Pin Icon
function createAirportPinIcon(code) {
  const html = `
    <div style="background: #1e293b; border: 1.5px solid #00b4d8; color: #00b4d8; border-radius: 4px; padding: 2px 5px; font-size: 10px; font-weight: 800; display: flex; align-items: center; gap: 3px; box-shadow: 0 2px 8px rgba(0,0,0,0.6);">
      <span style="display:inline-block; width:6px; height:6px; background:#00b4d8; border-radius:50%;"></span>
      ${code}
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'airport-pin-icon',
    iconSize: [45, 20],
    iconAnchor: [22, 10]
  });
}

export default function MapView({ flights, selectedFlight, setSelectedFlight, onTriggerEmergency }) {
  const [mapZoom] = useState(4);
  const [mapCenter] = useState([44.0, -40.0]); // Atlantic Flight Corridor View
  const [showTrails, setShowTrails] = useState(true);
  const [showRadarSweep, setShowRadarSweep] = useState(true);
  const [mapTileStyle, setMapTileStyle] = useState('dark'); // 'dark' | 'satellite' | 'street'
  const [showAirports, setShowAirports] = useState(true);

  // Global airports database
  const airports = [
    { code: 'JFK', name: 'John F. Kennedy Intl', city: 'New York', lat: 40.6413, lon: -73.7781 },
    { code: 'LHR', name: 'London Heathrow', city: 'London', lat: 51.4700, lon: -0.4543 },
    { code: 'LAX', name: 'Los Angeles Intl', city: 'Los Angeles', lat: 33.9416, lon: -118.4085 },
    { code: 'SFO', name: 'San Francisco Intl', city: 'San Francisco', lat: 37.6213, lon: -122.3790 },
    { code: 'HND', name: 'Tokyo Haneda', city: 'Tokyo', lat: 35.5494, lon: 139.7798 },
    { code: 'DXB', name: 'Dubai Intl', city: 'Dubai', lat: 25.2532, lon: 55.3657 },
    { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', lat: 50.0379, lon: 8.5622 },
    { code: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', lat: 49.0097, lon: 2.5479 }
  ];

  const mapTileUrls = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 72px)', overflow: 'hidden' }}>
      
      {/* Radar Sweep Overlay */}
      {showRadarSweep && (
        <div className="radar-sweep-container" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 450 }}>
          <div className="radar-sweep-line" />
        </div>
      )}

      {/* Map Style & Layer Switcher HUD */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div className="glass-panel" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', background: '#facc15', borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>FLIGHTRADAR24 LIVE</span>
          </div>
          <span style={{ fontSize: '12px', background: '#facc15', color: '#000', fontWeight: '800', padding: '2px 8px', borderRadius: '10px' }}>
            {flights.length} Aircraft
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '6px 10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            className={mapTileStyle === 'dark' ? 'btn-fr24-yellow' : 'btn-secondary'}
            onClick={() => setMapTileStyle('dark')}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            FR24 Dark
          </button>
          <button
            className={mapTileStyle === 'satellite' ? 'btn-fr24-yellow' : 'btn-secondary'}
            onClick={() => setMapTileStyle('satellite')}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            Satellite
          </button>
          <button
            className={showTrails ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setShowTrails(!showTrails)}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            {showTrails ? 'Trails On' : 'Trails Off'}
          </button>
        </div>
      </div>

      {/* FR24 Altitude Legend */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '16px',
        zIndex: 500
      }}>
        <div className="glass-panel" style={{ padding: '10px 14px', fontSize: '11px' }}>
          <div style={{ fontWeight: '700', color: '#facc15', marginBottom: '6px', letterSpacing: '0.04em' }}>ALTITUDE COLOR PROFILE</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#a855f7', borderRadius: '2px' }}/> FL380+</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#00b4d8', borderRadius: '2px' }}/> FL300-370</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }}/> FL200-290</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px' }}/> FL100-190</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }}/> &lt;FL100 / MAYDAY</div>
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
        <TileLayer
          url={mapTileUrls[mapTileStyle]}
          attribution='&copy; Flightradar24 Engine &copy; OpenStreetMap'
          maxZoom={19}
        />

        {/* Airport Hub Markers */}
        {showAirports && airports.map(ap => (
          <Marker
            key={ap.code}
            position={[ap.lat, ap.lon]}
            icon={createAirportPinIcon(ap.code)}
          >
            <Popup>
              <div style={{ padding: '4px', minWidth: '160px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#00b4d8' }}>{ap.code} Airport</div>
                <div style={{ fontSize: '12px', color: '#fff' }}>{ap.name}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{ap.city}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Flight Markers & Trajectory Polylines */}
        {flights.map(flight => {
          const lat = flight.currentPosition?.lat || flight.lat;
          const lon = flight.currentPosition?.lon || flight.lon;
          const alt = flight.currentPosition?.altitudeFt || flight.altitudeFt || 30000;
          const heading = flight.currentPosition?.headingDeg || flight.headingDeg || 0;
          const speed = flight.currentPosition?.speedKnots || flight.speedKnots || 450;
          const squawk = flight.squawk || '1200';
          const isSelected = selectedFlight?.flightId === flight.flightId;
          const squawkBadge = getSquawkBadge(squawk);

          const icon = createFR24PlaneIcon(heading, squawk, alt, isSelected);

          const trajectoryPoints = (flight.trajectory || []).map(t => [t.lat, t.lon]);
          if (trajectoryPoints.length > 0 && lat && lon) {
            trajectoryPoints.push([lat, lon]);
          }

          return (
            <React.Fragment key={flight.flightId}>
              {/* Flight Trajectory Line */}
              {showTrails && trajectoryPoints.length > 1 && (
                <Polyline
                  positions={trajectoryPoints}
                  color={squawkBadge.isEmergency ? '#ef4444' : isSelected ? '#00b4d8' : '#facc15'}
                  weight={isSelected ? 3 : 2}
                  opacity={isSelected ? 0.9 : 0.6}
                />
              )}

              {/* Emergency clearance circle for 7700 squawks */}
              {squawkBadge.isEmergency && lat && lon && (
                <Circle
                  center={[lat, lon]}
                  radius={50000}
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 1.5 }}
                />
              )}

              {/* Yellow FR24 Aircraft Marker */}
              {lat && lon && (
                <Marker
                  position={[lat, lon]}
                  icon={icon}
                  eventHandlers={{
                    click: () => setSelectedFlight(flight)
                  }}
                >
                  {/* FR24 Flight Tooltip on Hover */}
                  <Tooltip direction="top" offset={[0, -18]} opacity={0.9} permanent={false}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: isSelected ? '#00b4d8' : '#facc15' }}>
                      {flight.callsign} • {formatAltitude(alt)} • {speed} kts
                    </div>
                  </Tooltip>

                  <Popup>
                    <div style={{ padding: '6px', minWidth: '190px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '800', fontSize: '16px', color: '#facc15' }}>{flight.callsign}</span>
                        <span style={{
                          background: squawkBadge.isEmergency ? '#ef4444' : 'rgba(250, 204, 21, 0.2)',
                          color: squawkBadge.isEmergency ? '#fff' : '#facc15',
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {squawkBadge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#d1d5db' }}>{flight.airline} ({flight.aircraftType})</div>
                      <div style={{ fontSize: '12px', margin: '4px 0', color: '#38bdf8', fontWeight: '600' }}>
                        {flight.origin?.code} ➔ {flight.destination?.code} ({flight.progressPct}% done)
                      </div>
                      <div className="font-mono-hud" style={{ fontSize: '11px', color: '#9ca3af', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px' }}>
                        <div>ALT: {formatAltitude(alt)}</div>
                        <div>SPD: {speed} kts</div>
                        <div>HDG: {heading}°</div>
                        <div>REG: {flight.registration || 'N104AN'}</div>
                      </div>
                      <button
                        className="btn-fr24-yellow"
                        style={{ width: '100%', marginTop: '8px', fontSize: '11px', justifyContent: 'center' }}
                        onClick={() => setSelectedFlight(flight)}
                      >
                        Inspect Flightradar24 Panel
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
