import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

const SocketContext = createContext();

// ── Realistic flight physics dead-reckoning between polling intervals ─────────
const DEG2RAD = Math.PI / 180;

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

  // Gradual turn (3°/sec standard rate)
  const maxTurnRate = 3.0;
  const headingDiff = ((targetHeading - headingDeg + 540) % 360) - 180;
  const turnStep = Math.min(Math.abs(headingDiff), maxTurnRate * dtSeconds);
  headingDeg = (headingDeg + Math.sign(headingDiff) * turnStep + 360) % 360;

  // Smooth speed adjustment
  const speedDiff = targetSpeed - speedKnots;
  const speedStep = Math.min(Math.abs(speedDiff), 1.0 * dtSeconds);
  speedKnots = speedKnots + Math.sign(speedDiff) * speedStep;

  // Micro wind variance for realistic movement
  speedKnots += (Math.random() - 0.5) * 0.4;

  // Altitude update
  altitudeFt = altitudeFt + (vertRate * dtSeconds / 60);
  altitudeFt = Math.min(45000, Math.max(500, altitudeFt));

  // Dead-reckoning position update
  const dtHours = dtSeconds / 3600;
  const distNM = speedKnots * dtHours;
  const hdRad = headingDeg * DEG2RAD;
  const latRad = lat * DEG2RAD;
  lat = lat + (distNM / 60) * Math.cos(hdRad);
  lon = lon + (distNM / 60) * Math.sin(hdRad) / (Math.cos(latRad) || 0.001);
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;

  return {
    ...f,
    lat,
    lon,
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
  const [isConnected, setIsConnected] = useState(false);
  const [liveFlights, setLiveFlights] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState(null);

  const flightsRef = useRef([]);
  const lastTickRef = useRef(null);
  const lastRenderUpdateRef = useRef(0);
  const rafIdRef = useRef(null);

  // ── Smooth physics dead-reckoning animation loop ──────────────────────────
  const animate = useCallback((now) => {
    rafIdRef.current = requestAnimationFrame(animate);

    if (flightsRef.current.length === 0) return;

    if (lastTickRef.current === null) {
      lastTickRef.current = now;
      return;
    }

    const dtSeconds = (now - lastTickRef.current) / 1000;
    lastTickRef.current = now;

    const safeDt = Math.min(dtSeconds, 2);
    if (safeDt <= 0) return;

    const updated = flightsRef.current.map(f => deadReckonFlight(f, safeDt));
    flightsRef.current = updated;

    // Throttle React state re-renders to every 500ms to keep 60fps UI smooth with 1,000 aircraft
    if (now - lastRenderUpdateRef.current > 500) {
      lastRenderUpdateRef.current = now;
      setLiveFlights(updated);
    }
  }, []);

  useEffect(() => {
    rafIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [animate]);

  // ── REST Polling every 10 seconds (Compliance with Architecture) ────────────
  useEffect(() => {
    const pollIntervalMs = parseInt(import.meta.env.VITE_POLL_INTERVAL_MS || '10000', 10);
    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchTelemetry = async () => {
      try {
        // 1. Fetch live aircraft positions from ClickHouse via backend API
        const flightsRes = await fetch(`${apiBase}/api/flights?limit=2000`);
        if (!flightsRes.ok) throw new Error(`HTTP error ${flightsRes.status}`);
        const flightsData = await flightsRes.json();

        if (flightsData.success && Array.isArray(flightsData.flights)) {
          flightsRef.current = flightsData.flights;
          lastTickRef.current = null;
          setLiveFlights(flightsData.flights);
          setLastTelemetryTimestamp(flightsData.timestamp || new Date().toISOString());
          setIsConnected(true);
        }

        // 2. Fetch recent anomalies from ClickHouse via backend API
        const alertsRes = await fetch(`${apiBase}/api/anomalies`);
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          if (alertsData.success && Array.isArray(alertsData.anomalies)) {
            setLiveAlerts(alertsData.anomalies);
          }
        }
      } catch (err) {
        console.error('REST Polling Error:', err.message);
        setIsConnected(false);
      }
    };

    // Initial immediate fetch
    fetchTelemetry();

    // Periodic 10-second polling timer
    const timerId = setInterval(fetchTelemetry, pollIntervalMs);

    return () => clearInterval(timerId);
  }, []);

  return (
    <SocketContext.Provider value={{
      socket: null,
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
