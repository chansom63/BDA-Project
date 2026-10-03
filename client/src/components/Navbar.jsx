import React, { useState, useEffect } from 'react';
import { Plane, Radio, AlertTriangle, Database, BarChart3, Settings, Layers, Shield, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Navbar({ activeTab, setActiveTab, activeAlertCount }) {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date().toUTCString().slice(17, 25) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { id: 'map', label: 'Flight Radar Map', icon: Plane },
    { id: 'table', label: 'Telemetry List', icon: Radio },
    { id: 'alerts', label: 'Alert Center', icon: AlertTriangle, badge: activeAlertCount },
    { id: 'pipeline', label: 'AWS Pipeline', icon: Layers },
    { id: 'analytics', label: 'QuickSight BI', icon: BarChart3 },
    { id: 'admin', label: 'Admin Panel', icon: Settings }
  ];

  return (
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '12px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Title & AWS Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #ff9900 0%, #a855f7 100%)',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(255, 153, 0, 0.4)'
          }}>
            <Plane size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', letterSpacing: '-0.02em' }}>
                Monolithic MERN Architecture on AWS
              </h1>
              <span style={{
                background: 'rgba(255, 153, 0, 0.15)',
                color: '#ff9900',
                border: '1px solid rgba(255, 153, 0, 0.4)',
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                EC2 MONOLITH
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>
              Real-Time Flight Telemetry & Tracking System • AWS MSK ➔ Kinesis ➔ DocumentDB ➔ S3 ➔ Glue ➔ Redshift
            </p>
          </div>
        </div>

        {/* Center Nav Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 0, 0, 0.3)', padding: '4px', borderRadius: '10px' }}>
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
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                  color: isActive ? '#fff' : '#9ca3af',
                  fontWeight: isActive ? '600' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    marginLeft: '4px'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* System Status & User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderRadius: '8px' }}>
            <Clock size={14} color="#10b981" />
            <span className="font-mono-hud" style={{ fontSize: '13px', color: '#10b981' }}>{utcTime}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? '#10b981' : '#ef4444',
              boxShadow: isConnected ? '0 0 8px #10b981' : 'none'
            }} />
            <span style={{ color: isConnected ? '#10b981' : '#ef4444', fontWeight: '600' }}>
              {isConnected ? 'MSK FEED LIVE' : 'CONNECTING...'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '13px',
              color: '#10b981',
              border: '1px solid var(--primary-green)'
            }}>
              {user?.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#f3f4f6' }}>{user?.username}</div>
              <div style={{ fontSize: '10px', color: '#a855f7', fontWeight: '600' }}>{user?.role || 'Admin'}</div>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
}
