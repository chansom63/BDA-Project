import React, { useState } from 'react';
import { Play, Pause, ShieldAlert, PlusCircle, FastForward, Wind } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SimulatorControlPanel({ flights, onTriggerEmergency }) {
  const { token } = useAuth();
  const [injecting, setInjecting] = useState(false);

  const injectFlight = async () => {
    setInjecting(true);
    try {
      const res = await fetch('/api/flights/inject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          callsign: `TEST${Math.floor(100 + Math.random() * 900)}`,
          airline: 'AWS Air Transport',
          aircraftType: 'Boeing 787-10',
          origin: { code: 'JFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
          destination: { code: 'CDG', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479 },
          lat: 44.0 + Math.random() * 4,
          lon: -50.0 + Math.random() * 10,
          altitudeFt: 36000,
          speedKnots: 490
        })
      });
      await res.json();
    } catch (err) {
      console.error('Error injecting flight:', err);
    } finally {
      setInjecting(false);
    }
  };

  const triggerRandomMayday = () => {
    if (flights.length > 0) {
      const randomFlight = flights[Math.floor(Math.random() * flights.length)];
      onTriggerEmergency(randomFlight.flightId, '7700');
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      zIndex: 500
    }}>
      <div className="glass-panel" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#ff9900' }}>SIMULATOR HUD</span>
        
        <button
          className="btn-secondary"
          style={{ fontSize: '11px', padding: '4px 8px' }}
          onClick={injectFlight}
          disabled={injecting}
        >
          <PlusCircle size={13} color="#10b981" />
          Inject Aircraft
        </button>

        <button
          className="btn-danger"
          style={{ fontSize: '11px', padding: '4px 8px' }}
          onClick={triggerRandomMayday}
        >
          <ShieldAlert size={13} />
          Trigger 7700 MAYDAY
        </button>
      </div>
    </div>
  );
}
