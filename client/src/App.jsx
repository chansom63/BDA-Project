import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import FlightDrawer from './components/FlightDrawer';
import FlightList from './components/FlightList';
import AlertCenter from './components/AlertCenter';
import AwsPipelineVisualizer from './components/AwsPipelineVisualizer';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AdminPanel from './components/AdminPanel';
import SplashLoader from './components/SplashLoader';

import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';

function MainApp() {
  const { liveFlights, liveAlerts } = useSocket();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('map');
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [flightsList, setFlightsList] = useState([]);

  useEffect(() => {
    if (liveFlights && liveFlights.length > 0) {
      setFlightsList(liveFlights);
      setSelectedFlight(prev => {
        if (!prev) return null;
        const updated = liveFlights.find(f => f.flightId === prev.flightId);
        return updated || prev;
      });
    }
  }, [liveFlights]);

  // Initial fetch for REST fallback
  useEffect(() => {
    const fetchInitialFlights = async () => {
      try {
        const res = await fetch('/api/flights');
        const data = await res.json();
        if (data.success && data.flights) {
          setFlightsList(data.flights);
        }
      } catch (err) {
        console.error('Error fetching initial flights:', err);
      }
    };
    fetchInitialFlights();
  }, []);

  const handleTriggerSquawk = async (flightId, squawkCode) => {
    try {
      const res = await fetch(`/api/flights/${flightId}/squawk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ squawkCode })
      });
      const data = await res.json();
      if (data.success && data.flight) {
        setSelectedFlight(data.flight);
      }
    } catch (err) {
      console.error('Error setting squawk code:', err);
    }
  };

  const activeAlertsCount = (liveAlerts || []).filter(a => a.status === 'Active').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fr24-black)', display: 'flex', flexDirection: 'column' }}>

      {/* Flightradar24 Top Header Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAlertCount={activeAlertsCount}
        flights={flightsList}
        onSelectFlight={(flight) => {
          setSelectedFlight(flight);
          setActiveTab('map');
        }}
      />

      {/* Main Container */}
      <main style={{ flex: 1, position: 'relative' }}>

        {activeTab === 'map' && (
          <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 72px)' }}>
            <MapView
              flights={flightsList}
              selectedFlight={selectedFlight}
              setSelectedFlight={setSelectedFlight}
              onTriggerEmergency={handleTriggerSquawk}
            />
            {selectedFlight && (
              <FlightDrawer
                flight={selectedFlight}
                onClose={() => setSelectedFlight(null)}
                onTriggerSquawk={handleTriggerSquawk}
              />
            )}
          </div>
        )}

        {activeTab === 'table' && (
          <FlightList
            flights={flightsList}
            setSelectedFlight={(flight) => {
              setSelectedFlight(flight);
              setActiveTab('map');
            }}
            onTriggerSquawk={handleTriggerSquawk}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertCenter />
        )}

        {activeTab === 'pipeline' && (
          <AwsPipelineVisualizer />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard />
        )}

        {activeTab === 'admin' && (
          <AdminPanel />
        )}

      </main>
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);



  return (
    <>
      {showSplash && <SplashLoader onComplete={() => setShowSplash(false)} />}
      <AuthProvider>
        <SocketProvider>
          <MainApp />
        </SocketProvider>
      </AuthProvider>
    </>

  );
}
