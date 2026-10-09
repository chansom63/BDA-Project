import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, Tooltip, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Plane, AlertTriangle, Wind, Navigation, ShieldAlert, Activity, Layers, MapPin } from 'lucide-react';
import { formatAltitude, getAltitudeColor, getSquawkBadge } from '../utils/geoUtils';
import GaganLogo from './GaganLogo';

// Helper to construct Flightradar24 rotated yellow plane icon
function createFR24PlaneIcon(headingDeg, squawk, altitudeFt, isSelected) {
  const isEmergency = ['7700', '7600', '7500'].includes(squawk);

  // Signature Flightradar24 colors: Yellow (#facc15) standard, Cyan (#00b4d8) selected, Red (#ef4444) emergency
  const strokeColor = isEmergency ? '#ef4444' : isSelected ? '#00b4d8' : '#000000';
  const fillColor = isEmergency ? '#ef4444' : isSelected ? '#00b4d8' : '#facc15';

  const svgHtml = `
    <div style="transform: rotate(${headingDeg}deg); transition: transform 0.4s ease-out; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1" stroke-linejoin="round">
        <path d="M11 2.2C11 1.5 11.4 1 12 1s1 .5 1 1.2v6.3l7.6 5.8v2l-7.6-3.2v5.1l2.2 2v1.5l-3.2-1.3-3.2 1.3V20l2.2-2v-5.1L3.4 16.1v-2l7.6-5.8V2.2z"/>
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
  const [maxAircraft, setMaxAircraft] = useState(1000);
  const [showDropdown, setShowDropdown] = useState(false);

  const displayedFlights = maxAircraft === 1000 ? flights : flights.slice(-maxAircraft);

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
    dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
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
        zIndex: 2000,
      }}>
        {/* Flex panel stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="glass-panel" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GaganLogo size={26} />
              <span style={{ fontSize: '14px', fontWeight: '900', color: '#facc15', letterSpacing: '0.5px' }}>GAGAN LIVE</span>
            </div>
            <span
              onClick={() => setShowDropdown(!showDropdown)}
              style={{ fontSize: '11px', background: 'rgba(250, 204, 21, 0.2)', color: '#facc15', border: '1px solid rgba(250, 204, 21, 0.4)', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer', userSelect: 'none' }}
            >
              {(displayedFlights || flights || []).length} Aircraft
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
            <button
              className={showRadarSweep ? 'btn-fr24-yellow' : 'btn-secondary'}
              onClick={() => setShowRadarSweep(!showRadarSweep)}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              {showRadarSweep ? 'Radar On' : 'Radar Off'}
            </button>
          </div>
        </div>

        {/* Dropdown rendered OUTSIDE the flex stack so it floats above everything */}
        {showDropdown && (
          <div style={{ position: 'absolute', top: '42px', right: '0', background: '#0f172a', border: '1px solid #facc15', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 9999, minWidth: '56px', boxShadow: '0 4px 16px rgba(0,0,0,0.8)' }}>
            {[100, 500, 1000].map(val => (
              <button
                key={val}
                onClick={() => { setMaxAircraft(val); setShowDropdown(false); }}
                style={{ display: 'block', width: '100%', padding: '5px 10px', background: val === maxAircraft ? '#facc15' : 'transparent', border: 'none', color: val === maxAircraft ? '#000' : '#ccc', fontSize: '12px', fontWeight: val === maxAircraft ? '800' : '600', cursor: 'pointer', textAlign: 'center', borderBottom: val !== 1000 ? '1px solid #1e293b' : 'none' }}
                onMouseOver={e => { e.currentTarget.style.background = '#facc15'; e.currentTarget.style.color = '#000'; }}
                onMouseOut={e => { e.currentTarget.style.background = val === maxAircraft ? '#facc15' : 'transparent'; e.currentTarget.style.color = val === maxAircraft ? '#000' : '#ccc'; }}
              >
                {val}
              </button>
            ))}
          </div>
        )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#a855f7', borderRadius: '2px' }} /> FL380+</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#00b4d8', borderRadius: '2px' }} /> FL300-370</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }} /> FL200-290</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px' }} /> FL100-190</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }} /> &lt;FL100 / MAYDAY</div>
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

        <ZoomControl position="bottomright" />

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
        {displayedFlights.map(flight => {
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

          const originPoint = flight.origin?.lat && flight.origin?.lon ? [flight.origin.lat, flight.origin.lon] : null;
          const destPoint = flight.destination?.lat && flight.destination?.lon ? [flight.destination.lat, flight.destination.lon] : null;

          return (
            <React.Fragment key={flight.flightId}>
              {/* Flight Trajectory Line */}
              {(showTrails || isSelected) && trajectoryPoints.length > 1 && (
                <Polyline
                  positions={trajectoryPoints}
                  color={squawkBadge.isEmergency ? '#ef4444' : isSelected ? '#00b4d8' : '#facc15'}
                  weight={isSelected ? 3 : 2}
                  opacity={isSelected ? 0.9 : 0.6}
                />
              )}

              {/* Past/Unrecorded route to origin (dashed) */}
              {isSelected && originPoint && (
                <Polyline
                  positions={[originPoint, trajectoryPoints.length > 0 ? trajectoryPoints[0] : [lat, lon]]}
                  color={squawkBadge.isEmergency ? '#ef4444' : '#00b4d8'}
                  weight={2}
                  opacity={0.6}
                  dashArray="5 5"
                />
              )}

              {/* Future route to destination (dashed) */}
              {isSelected && destPoint && (
                <Polyline
                  positions={[[lat, lon], destPoint]}
                  color="#9ca3af"
                  weight={2}
                  opacity={0.8}
                  dashArray="5 5"
                />
              )}

              {/* Origin Airport Pin */}
              {isSelected && originPoint && (
                <Marker position={originPoint} icon={createAirportPinIcon(flight.origin.code)} zIndexOffset={-100}>
                  <Tooltip direction="bottom" offset={[0, 10]} opacity={0.9} permanent>
                    <div style={{ fontSize: '10px', textAlign: 'center' }}>Origin<br /><b>{flight.origin.city}</b></div>
                  </Tooltip>
                </Marker>
              )}

              {/* Destination Airport Pin */}
              {isSelected && destPoint && (
                <Marker position={destPoint} icon={createAirportPinIcon(flight.destination.code)} zIndexOffset={-100}>
                  <Tooltip direction="bottom" offset={[0, 10]} opacity={0.9} permanent>
                    <div style={{ fontSize: '10px', textAlign: 'center' }}>Destination<br /><b>{flight.destination.city}</b></div>
                  </Tooltip>
                </Marker>
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
                    mousedown: () => setSelectedFlight(flight),
                    click: () => setSelectedFlight(flight)
                  }}
                >
                  {/* FR24 Flight Tooltip on Hover */}
                  <Tooltip direction="top" offset={[0, -18]} opacity={0.9} permanent={false}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: isSelected ? '#00b4d8' : '#facc15' }}>
                      {flight.callsign} • {formatAltitude(alt)} • {Number(speed).toFixed(1)} kts
                    </div>
                  </Tooltip>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
