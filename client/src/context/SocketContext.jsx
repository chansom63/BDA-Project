import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

const SocketContext = createContext();

// ── Realistic flight physics dead-reckoning ───────────────────────────────────
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function deadReckonFlight(f, dtSeconds) {
  const pos = f.currentPosition || f;

  let lat = pos.lat ?? f.latitude ?? 0;
  let lon = pos.lon ?? f.longitude ?? 0;
  let speedKnots = pos.speedKnots ?? f.speedKnots ?? 450;
  let headingDeg = pos.headingDeg ?? f.headingDeg ?? 0;
  let altitudeFt = pos.altitudeFt ?? f.altitudeFt ?? 35000;
  let vertRate = pos.verticalRateFpm ?? f.verticalRateFpm ?? 0;
  let targetHeading = pos.targetHeading ?? headingDeg;
  let targetSpeed = pos.targetSpeed ?? speedKnots;

  if (!lat && !lon) return f;

  // ── Physics: gradual turn (3°/sec standard rate = 180°/min) ──────────────
  const maxTurnRate = 3.0; // deg/sec (standard rate turn)
  const headingDiff = ((targetHeading - headingDeg + 540) % 360) - 180;
  const turnStep = Math.min(Math.abs(headingDiff), maxTurnRate * dtSeconds);
  headingDeg = (headingDeg + Math.sign(headingDiff) * turnStep + 360) % 360;

  // ── Physics: smooth speed change (typical accel 1 kt/sec) ────────────────
  const speedDiff = targetSpeed - speedKnots;
  const speedStep = Math.min(Math.abs(speedDiff), 1.0 * dtSeconds);
  speedKnots = speedKnots + Math.sign(speedDiff) * speedStep;

  // Simulate realistic wind micro-turbulence for dynamic UI feeling
  speedKnots += (Math.random() - 0.5) * 0.4; // +/- 0.2 knots variance

  // ── Physics: altitude change via vertical rate ────────────────────────────
  altitudeFt = altitudeFt + (vertRate * dtSeconds / 60);
  altitudeFt = Math.min(45000, Math.max(500, altitudeFt));

  // ── Dead-reckoning position update ───────────────────────────────────────
  const dtHours = dtSeconds / 3600;
  const distNM = speedKnots * dtHours;
  const hdRad = headingDeg * DEG2RAD;
  const latRad = lat * DEG2RAD;
  lat = lat + (distNM / 60) * Math.cos(hdRad);
  lon = lon + (distNM / 60) * Math.sin(hdRad) / (Math.cos(latRad) || 0.001);

  return {
    ...f,
    latitude: lat,
    longitude: lon,
    altitudeFt: Math.round(altitudeFt),
    headingDeg: Math.round(headingDeg * 10) / 10,
    speedKnots: Math.round(speedKnots * 10) / 10,
    currentPosition: {
      lat, lon, altitudeFt, speedKnots, headingDeg, verticalRateFpm: vertRate,
      targetHeading, targetSpeed,
    },
  };
}

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [liveFlights, setLiveFlights] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState(null);

  // Refs for the animation loop — avoids stale closures
  const flightsRef = useRef([]);          // canonical server state
  const lastTickRef = useRef(null);        // timestamp of last rAF tick
  const rafIdRef = useRef(null);        // requestAnimationFrame id

  // ── Animation loop (requestAnimationFrame) ──────────────────────────────────
  const animate = useCallback((now) => {
    rafIdRef.current = requestAnimationFrame(animate);

    if (flightsRef.current.length === 0) return;

    if (lastTickRef.current === null) {
      lastTickRef.current = now;
      return;
    }

    const dtSeconds = (now - lastTickRef.current) / 1000;
    lastTickRef.current = now;

    // Cap dt to 2 s to avoid huge jumps after tab is backgrounded
    const safeDt = Math.min(dtSeconds, 2);
    if (safeDt <= 0) return;

    const updated = flightsRef.current.map(f => deadReckonFlight(f, safeDt));
    flightsRef.current = updated;
    setLiveFlights(updated);
  }, []);

  // Start / stop rAF loop
  useEffect(() => {
    rafIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [animate]);

  // ── WebSocket connection ────────────────────────────────────────────────────
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWS = () => {
      let wsUrl = '';

      // If deployed to Vercel (decoupled), use VITE_API_URL pointing to Render backend
      if (import.meta.env.VITE_API_URL) {
        // Convert http:// API URL to ws://
        wsUrl = import.meta.env.VITE_API_URL.replace(/^http/, 'ws') + '/ws/telemetry';
      } else {
        // Monolithic deployment fallback (Vite proxy or Node serving React)
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${wsProtocol}//${window.location.host}/ws/telemetry`;
      }

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('📡 WebSocket Connected to AWS Flight Telemetry Stream');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TELEMETRY_UPDATE') {
            const incoming = data.flights || [];
            flightsRef.current = incoming;
            lastTickRef.current = null;
            setLiveFlights(incoming);
            setLastTelemetryTimestamp(data.timestamp);
          } else if (data.type === 'NEW_ALERT') {
            setLiveAlerts(prev => [data.alert, ...prev]);
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket Closed. Retrying in 3s...');
        setIsConnected(false);
        reconnectTimeout = setTimeout(() => {
          connectWS();
        }, 3000);
      };

      setSocket(ws);
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
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
