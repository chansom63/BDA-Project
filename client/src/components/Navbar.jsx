import React, { useState, useEffect } from 'react';
import { Plane, Radio, AlertTriangle, Database, BarChart3, Settings, Layers, Shield, Clock, Search, Zap, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import GaganLogo from './GaganLogo';

export default function Navbar({ activeTab, setActiveTab, activeAlertCount, flights, onSelectFlight }) {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const [utcTime, setUtcTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date().toUTCString().slice(17, 25) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query || query.trim() === '') {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const q = query.toLowerCase();
    const matches = (flights || []).filter(f =>
      f.callsign?.toLowerCase().includes(q) ||
      f.flightId?.toLowerCase().includes(q) ||
      f.airline?.toLowerCase().includes(q) ||
      f.aircraftType?.toLowerCase().includes(q) ||
      f.origin?.code?.toLowerCase().includes(q) ||
      f.destination?.code?.toLowerCase().includes(q)
    );
    setSearchResults(matches);
    setShowDropdown(true);
  };

  const navItems = [
    { id: 'map', label: 'Flight Radar Map', icon: Plane },
    { id: 'table', label: 'Telemetry List', icon: Radio },
    { id: 'alerts', label: 'Alert Center', icon: AlertTriangle, badge: activeAlertCount },
    { id: 'analytics', label: 'Spark BI Analytics', icon: BarChart3 },
    { id: 'admin', label: 'Admin Panel', icon: Settings }
  ];

  return (
    <header style={{ background: '#0b0f17', borderBottom: '1px solid var(--fr24-panel-border)', padding: '10px 20px', zIndex: 1000, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>

        {/* Title & GAGAN Fancy Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <GaganLogo size={42} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#facc15', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                GAGAN
              </h1>
              <span style={{
                background: 'rgba(250, 204, 21, 0.15)',
                color: '#facc15',
                border: '1px solid rgba(250, 204, 21, 0.4)',
                fontSize: '10px',
                fontWeight: '800',
                padding: '1px 8px',
                borderRadius: '10px'
              }}>
                AWS ANALYTICS
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>
              Geospatial Aircraft Guidance & Analytics Network • Real-Time Telemetry Tracking
            </p>
          </div>
        </div>

        {/* FR24 Real-Time Autocomplete Search Bar */}
        <div style={{ position: 'relative', width: '300px' }}>
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#161d2a' }}>
            <Search size={15} color="#facc15" />
            <input
              type="text"
              placeholder="Search flight, airline, airport..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchQuery && setShowDropdown(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                outline: 'none',
                fontSize: '12px',
                width: '100%'
              }}
            />
          </div>

          {/* Search Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="glass-panel" style={{
              position: 'absolute',
              top: '40px',
              left: 0,
              right: 0,
              background: '#161d2a',
              border: '1px solid #facc15',
              borderRadius: '8px',
              maxHeight: '260px',
              overflowY: 'auto',
              zIndex: 1100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.8)'
            }}>
              {searchResults.map(f => (
                <div
                  key={f.flightId}
                  onClick={() => {
                    if (onSelectFlight) onSelectFlight(f);
                    setActiveTab('map');
                    setShowDropdown(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--fr24-panel-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(250, 204, 21, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#facc15' }}>{f.callsign} ({f.flightId})</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{f.airline} • {f.aircraftType}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#00b4d8', fontWeight: '700' }}>
                    {f.origin?.code} ➔ {f.destination?.code}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#111722', padding: '3px', borderRadius: '8px' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, #facc15 0%, #eab308 100%)' : 'transparent',
                  color: isActive ? '#000' : '#9ca3af',
                  fontWeight: isActive ? '800' : '500',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={14} color={isActive ? '#000' : undefined} />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="emergency-pulse" style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '1px 5px',
                    borderRadius: '8px',
                    marginLeft: '2px'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* System Status & Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#111722', padding: '5px 10px', borderRadius: '6px' }}>
            <Clock size={13} color="#facc15" />
            <span className="font-mono-hud" style={{ fontSize: '12px', color: '#facc15' }}>{utcTime}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? '#10b981' : '#ef4444',
              boxShadow: isConnected ? '0 0 8px #10b981' : 'none'
            }} />
            <span style={{ color: isConnected ? '#10b981' : '#ef4444', fontWeight: '700' }}>
              {isConnected ? 'KAFKA LIVE' : 'CONNECTING...'}
            </span>
          </div>
        </div>

      </div>
    </header>
  );
}
