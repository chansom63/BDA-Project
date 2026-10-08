import React, { useState, useEffect } from 'react';
import { Settings, Users, Shield, Save, CheckCircle, Sliders, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminPanel() {
  const { token } = useAuth();
  const [config, setConfig] = useState({
    proximityAlertDistanceNM: 10,
    simulationSpeedMultiplier: 1.0,
    autoNotificationEmail: true,
    autoNotificationSMS: true,
    weatherOverlayEnabled: true
  });
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchConfigAndUsers = async () => {
    try {
      const resConf = await fetch('/api/config');
      const dataConf = await resConf.json();
      if (dataConf.success && dataConf.config) {
        setConfig(dataConf.config);
      }

      const resUsers = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataUsers = await resUsers.json();
      if (dataUsers.success) {
        setUsers(dataUsers.users);
      }
    } catch (err) {
      console.error('Error fetching admin settings:', err);
    }
  };

  useEffect(() => {
    fetchConfigAndUsers();
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Airspace telemetry parameters updated successfully!');
      }
    } catch (err) {
      setMessage('Failed to save config.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff' }}>System Administration & Config</h2>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>Airspace safety threshold tuning, simulation speed controls, RBAC user management</p>
      </div>

      {message && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '20px', borderColor: '#10b981', color: '#10b981', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} /> {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Left: Airspace Safety & Simulator Configuration */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <Sliders size={20} color="#10b981" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>Airspace Threshold Settings</h3>
          </div>

          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div>
              <label style={{ fontSize: '13px', color: '#e5e7eb', display: 'block', marginBottom: '6px' }}>
                Proximity Breach Alert Distance: <strong>{config.proximityAlertDistanceNM} NM</strong>
              </label>
              <input
                type="range"
                min="2"
                max="30"
                step="1"
                value={config.proximityAlertDistanceNM || 10}
                onChange={(e) => setConfig({ ...config, proximityAlertDistanceNM: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#10b981' }}
              />
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Trigger warning if 2 aircraft approach within this distance</span>
            </div>

            <div>
              <label style={{ fontSize: '13px', color: '#e5e7eb', display: 'block', marginBottom: '6px' }}>
                Simulator Speed Multiplier: <strong>{config.simulationSpeedMultiplier}x</strong>
              </label>
              <select
                value={config.simulationSpeedMultiplier || 1.0}
                onChange={(e) => setConfig({ ...config, simulationSpeedMultiplier: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-color)',
                  color: '#fff'
                }}
              >
                <option value={1.0} style={{ background: '#111827' }}>1x Real-Time Speed</option>
                <option value={2.0} style={{ background: '#111827' }}>2x Speed</option>
                <option value={5.0} style={{ background: '#111827' }}>5x Accelerated Speed</option>
                <option value={10.0} style={{ background: '#111827' }}>10x High-Speed Simulation</option>
              </select>
            </div>


            <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: '12px', justifyContent: 'center' }}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Telemetry Configuration'}
            </button>
          </form>
        </div>

        {/* Right: RBAC User Management */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <Users size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>RBAC User Roles</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {users.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>Default seeded accounts active (Admin, Analyst, Dispatcher).</div>
            ) : (
              users.map(u => (
                <div key={u._id} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{u.username}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{u.email} • {u.department}</div>
                  </div>

                  <span style={{
                    background: u.role === 'Admin' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                    color: u.role === 'Admin' ? '#ef4444' : '#38bdf8',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '3px 10px',
                    borderRadius: '12px'
                  }}>
                    {u.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
