import React, { createContext, useContext, useEffect, useState } from 'react';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [liveFlights, setLiveFlights] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState(null);

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect to WebSocket server on port 5000 or current host
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/telemetry`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('📡 WebSocket Connected to AWS Flight Telemetry Stream');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'TELEMETRY_UPDATE') {
          setLiveFlights(data.flights || []);
          setLastTelemetryTimestamp(data.timestamp);
        } else if (data.type === 'NEW_ALERT') {
          setLiveAlerts(prev => [data.alert, ...prev]);
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket Connection Closed. Retrying in 3s...');
      setIsConnected(false);
      setTimeout(() => {
        // Attempt reconnect logic
      }, 3000);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      liveFlights,
      liveAlerts,
      lastTelemetryTimestamp
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
