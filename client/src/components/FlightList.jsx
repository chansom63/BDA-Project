import React, { useState } from 'react';
import { Search, Filter, Plane, AlertTriangle, ShieldAlert } from 'lucide-react';
import { formatAltitude, getAltitudeColor, getSquawkBadge } from '../utils/geoUtils';

export default function FlightList({ flights, setSelectedFlight, onTriggerSquawk }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredFlights = flights.filter(flight => {
    const matchesSearch =
      flight.callsign?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flight.flightId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flight.airline?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flight.origin?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flight.destination?.code?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || flight.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>Flight Telemetry Directory</h2>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>Live parsed ADS-B stream records in Dockerized MongoDB operational database</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Search Box */}
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', minWidth: '280px' }}>
            <Search size={16} color="#9ca3af" />
            <input
              type="text"
              placeholder="Search callsign, airline, route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                outline: 'none',
                fontSize: '13px',
                width: '100%'
              }}
            />
          </div>

          {/* Status Filter */}
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px' }}>
            <Filter size={16} color="#9ca3af" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                outline: 'none',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="ALL" style={{ background: '#111827' }}>All Statuses</option>
              <option value="In-Flight" style={{ background: '#111827' }}>In-Flight</option>
              <option value="Emergency" style={{ background: '#111827' }}>Emergency</option>
              <option value="Landed" style={{ background: '#111827' }}>Landed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Telemetry Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid var(--border-color)', color: '#9ca3af', fontWeight: '600' }}>
              <th style={{ padding: '12px 16px' }}>FLIGHT / CALLSIGN</th>
              <th style={{ padding: '12px 16px' }}>AIRLINE & TYPE</th>
              <th style={{ padding: '12px 16px' }}>ROUTE</th>
              <th style={{ padding: '12px 16px' }}>ALTITUDE</th>
              <th style={{ padding: '12px 16px' }}>SPD / HDG</th>
              <th style={{ padding: '12px 16px' }}>SQUAWK</th>
              <th style={{ padding: '12px 16px' }}>STATUS</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredFlights.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
                  No matching telemetry events found.
                </td>
              </tr>
            ) : (
              filteredFlights.map(flight => {
                const alt = flight.currentPosition?.altitudeFt || flight.altitudeFt || 30000;
                const speed = flight.currentPosition?.speedKnots || flight.speedKnots || 450;
                const heading = flight.currentPosition?.headingDeg || flight.headingDeg || 0;
                const squawk = flight.squawk || '1200';
                const squawkBadge = getSquawkBadge(squawk);

                return (
                  <tr
                    key={flight.flightId}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background 0.2s ease',
                      background: squawkBadge.isEmergency ? 'rgba(239, 68, 68, 0.08)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plane size={16} color={squawkBadge.isEmergency ? '#ef4444' : '#10b981'} />
                        <div>
                          <div>{flight.callsign}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>ID: {flight.flightId}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', color: '#d1d5db' }}>
                      <div>{flight.airline}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{flight.aircraftType}</div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#38bdf8' }}>{flight.origin?.code} ➔ {flight.destination?.code}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{flight.progressPct}% Flown</div>
                    </td>

                    <td className="font-mono-hud" style={{ padding: '12px 16px', fontWeight: '600', color: getAltitudeColor(alt) }}>
                      {formatAltitude(alt)}
                    </td>

                    <td className="font-mono-hud" style={{ padding: '12px 16px', color: '#e5e7eb' }}>
                      {speed} kts / {heading}°
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: squawkBadge.isEmergency ? '#ef4444' : 'rgba(16, 185, 129, 0.2)',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {squawkBadge.label}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        color: flight.status === 'Emergency' ? '#ef4444' : '#10b981',
                        fontWeight: '600',
                        fontSize: '12px'
                      }}>
                        ● {flight.status}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-primary"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => setSelectedFlight(flight)}
                        >
                          View HUD
                        </button>
                        {['7700', '7600', '7500'].includes(squawk) && (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '11px', padding: '4px 10px' }}
                            onClick={() => onTriggerSquawk(flight.flightId, '1200')}
                          >
                            Reset Squawk
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
