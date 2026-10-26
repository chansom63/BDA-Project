import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import FlightDrawer from './components/FlightDrawer';
import FlightList from './components/FlightList';
import AlertCenter from './components/AlertCenter';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import SplashLoader from './components/SplashLoader';

import { SocketProvider, useSocket } from './context/SocketContext';

function MainApp() {
  const { liveFlights, liveAlerts } = useSocket();
  const [activeTab, setActiveTab] = useState('map');
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [flightsList, setFlightsList] = useState([]);

  // Keep flightsList in sync with live polling data from ClickHouse via REST API
  useEffect(() => {
    if (liveFlights && liveFlights.length > 0) {
      const sorted = [...liveFlights].sort((a, b) => {
        if (a.flightId && b.flightId) return a.flightId.localeCompare(b.flightId);
        return 0;
      });
      setFlightsList(sorted);
      setSelectedFlight(prev => {
        if (!prev) return null;
        return sorted.find(f => f.flightId === prev.flightId) || prev;
      });
    }
  }, [liveFlights]);

  const activeAlertsCount = (liveAlerts || []).filter(a =>
    a.severity === 'EMERGENCY' || a.status === 'Active'
  ).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fr24-black)', display: 'flex', flexDirection: 'column' }}>

      {/* Top navigation bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAlertCount={activeAlertsCount}
        flights={flightsList}
        onSelectFlight={flight => {
          setSelectedFlight(flight);
          setActiveTab('map');
        }}
      />

      {/* Main content area */}
      <main style={{ flex: 1, position: 'relative' }}>

        {activeTab === 'map' && (
          <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 72px)' }}>
            <MapView
              flights={flightsList}
              selectedFlight={selectedFlight}
              setSelectedFlight={setSelectedFlight}
            />
            {selectedFlight && (
              <FlightDrawer
                flight={selectedFlight}
                onClose={() => setSelectedFlight(null)}
              />
            )}
          </div>
        )}

        {activeTab === 'table' && (
          <FlightList
            flights={flightsList}
            setSelectedFlight={flight => {
              setSelectedFlight(flight);
              setActiveTab('map');
            }}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertCenter />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard />
        )}

      </main>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Dashboard error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', color: '#fff', background: '#0f172a', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#ef4444' }}>⚠️ Dashboard Display Error</h2>
          <pre style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', overflow: 'auto', marginTop: '16px', color: '#f87171' }}>
            {this.state.error?.stack || this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '16px', padding: '10px 20px', background: '#facc15', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <ErrorBoundary>
      {showSplash && <SplashLoader onComplete={() => setShowSplash(false)} />}
      <SocketProvider>
        <MainApp />
      </SocketProvider>
    </ErrorBoundary>
  );
}
