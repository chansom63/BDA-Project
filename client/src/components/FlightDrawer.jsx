import React, { useState } from 'react';
import { X, Plane, Navigation, Wind, ShieldAlert, Radio, Eye, Camera, Clock, Crosshair, Compass, Zap } from 'lucide-react';
import { formatAltitude, getAltitudeColor, getSquawkBadge } from '../utils/geoUtils';

// Aircraft photo pool — real plane photos keyed by aircraft type
const AIRCRAFT_PHOTOS = {
  'Boeing 737-800': 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=600&auto=format&fit=crop&q=80',
  'Boeing 737 MAX 8': 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=600&auto=format&fit=crop&q=80',
  'Boeing 777-300ER': 'https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=600&auto=format&fit=crop&q=80',
  'Boeing 787-9': 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&auto=format&fit=crop&q=80',
  'Boeing 747-8i': 'https://images.unsplash.com/photo-1483450388369-9ed95738483c?w=600&auto=format&fit=crop&q=80',
  'Airbus A320neo': 'https://images.unsplash.com/photo-1559668396-c2b6f1e91afa?w=600&auto=format&fit=crop&q=80',
  'Airbus A321neo': 'https://images.unsplash.com/photo-1606768666853-403c90a981ad?w=600&auto=format&fit=crop&q=80',
  'Airbus A330-300': 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&auto=format&fit=crop&q=80',
  'Airbus A350-900': 'https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?w=600&auto=format&fit=crop&q=80',
  'Airbus A380-800': 'https://images.unsplash.com/photo-1548889165-1231b8929e90?w=600&auto=format&fit=crop&q=80',
  'Embraer E190': 'https://images.unsplash.com/photo-1542296332-2e4473faf563?w=600&auto=format&fit=crop&q=80',
  'Bombardier CRJ-900': 'https://images.unsplash.com/photo-1587019158091-1a103c5dd17f?w=600&auto=format&fit=crop&q=80',
};
const DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=600&auto=format&fit=crop&q=80';

// Generate compass ticks from -360 to +720 degrees to allow for wide scrolling without running out of tape
const COMPASS_TICKS = [];
for (let d = -360; d <= 720; d += 15) {
  let normalized = (d % 360 + 360) % 360;
  let label = normalized.toString();
  if (normalized === 0) label = 'N';
  else if (normalized === 45) label = 'NE';
  else if (normalized === 90) label = 'E';
  else if (normalized === 135) label = 'SE';
  else if (normalized === 180) label = 'S';
  else if (normalized === 225) label = 'SW';
  else if (normalized === 270) label = 'W';
  else if (normalized === 315) label = 'NW';
  COMPASS_TICKS.push({ deg: d, label, isCardinal: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].includes(label) });
}

export default function FlightDrawer({ flight, onClose, onTriggerSquawk, onFollowFlight }) {
  const [show3DHud, setShow3DHud] = useState(false);
  const [following, setFollowing] = useState(false);

  // Seed live values from the real flight data
  const baseAlt = flight?.currentPosition?.altitudeFt || flight?.altitudeFt || 30000;
  const baseSpeed = flight?.currentPosition?.speedKnots || flight?.speedKnots || 450;
  const baseHdg = flight?.currentPosition?.headingDeg || flight?.headingDeg || 0;
  const baseVrate = flight?.currentPosition?.verticalRateFpm || flight?.verticalRateFpm || 0;

  const [liveAlt, setLiveAlt] = useState(baseAlt);
  const [liveSpeed, setLiveSpeed] = useState(baseSpeed);
  const [liveHdg, setLiveHdg] = useState(baseHdg);
  const [liveVrate, setLiveVrate] = useState(baseVrate);

  // Generate a random animation delay based on the current flight so the horizon doesn't always start flat
  const randomRollDelay = React.useMemo(() => `-${Math.floor(Math.random() * 30)}s`, [flight.flightId]);

  // Store the true ground-truth values in a ref so the interval can access the latest without stale closures
  const trueData = React.useRef({ alt: baseAlt, speed: baseSpeed, hdg: baseHdg, vrate: baseVrate });

  // Keep the baseline targets updated with real WebSocket data silently
  useEffect(() => {
    trueData.current = { alt: baseAlt, speed: baseSpeed, hdg: baseHdg, vrate: baseVrate };
  }, [baseAlt, baseSpeed, baseHdg, baseVrate]);

  // Completely reset the visible numbers ONLY when we click a new flight
  useEffect(() => {
    setLiveAlt(baseAlt);
    setLiveSpeed(baseSpeed);
    setLiveHdg(baseHdg);
    setLiveVrate(baseVrate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.flightId]);

  // Micro-animate every 1.0s to simulate live physics
  useEffect(() => {
    const interval = setInterval(() => {
      // Use independent bounded random walks with gravity.
      // This guarantees each metric shifts independently, and ONLY increments/decrements by tiny, smooth steps (e.g. 0, 1, 2) without abrupt jumps.
      const applyPhysics = (prev, target, stepSize, maxWander) => {
        const diff = target - prev;

        // If the true server data changed massively, fast-forward catch up
        if (Math.abs(diff) > maxWander * 3) {
          return prev + (diff * 0.5);
        }

        // Random walk
        let step = (Math.floor(Math.random() * 3) - 1) * stepSize;

        // Weak gravity: only kicks in occasionally so it can wander further (e.g., 0, 1, 2, 3)
        if (diff > 0 && Math.random() > 0.6) step = stepSize;
        if (diff < 0 && Math.random() > 0.6) step = -stepSize;

        // Hard bounds
        if (diff > maxWander) step = stepSize;
        if (diff < -maxWander) step = -stepSize;

        return prev + step;
      };

      setLiveAlt((prev) => Math.max(0, applyPhysics(prev, trueData.current.alt, 2, 15)));
      setLiveVrate((prev) => applyPhysics(prev, trueData.current.vrate, 1, 10));
      setLiveSpeed((prev) => Math.max(0, applyPhysics(prev, trueData.current.speed, 1, 3)));

      setLiveHdg((prev) => {
        const target = trueData.current.hdg;
        let diff = ((target - prev + 540) % 360) - 180;

        if (Math.abs(diff) > 10) return (prev + (diff * 0.5) + 360) % 360;

        let step = Math.floor(Math.random() * 3) - 1;
        if (diff > 0 && Math.random() > 0.6) step = 1;
        if (diff < 0 && Math.random() > 0.6) step = -1;
        if (diff > 3) step = 1;
        if (diff < -3) step = -1;
        return (prev + step + 360) % 360;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!flight) return null;

  const lat = flight.currentPosition?.lat || flight.lat;
  const lon = flight.currentPosition?.lon || flight.lon;
  const alt = Math.round(liveAlt);
  const speed = Math.round(liveSpeed);
  const heading = Math.round(liveHdg);
  const vrate = Math.round(liveVrate);
  const squawk = flight.squawk || '1200';
  const squawkBadge = getSquawkBadge(squawk);

  const toggleFollow = () => {
    setFollowing(!following);
    if (onFollowFlight) onFollowFlight(flight, !following);
  };

  return (
    <aside className="fr24-drawer">

      {/* FR24 Header */}
      <div style={{ background: '#111722', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--fr24-panel-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>{flight.countryFlag || '✈️'}</span>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#facc15', letterSpacing: '-0.02em' }}>
              {flight.callsign} <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '400' }}>({flight.flightId})</span>
            </div>
            <div style={{ fontSize: '12px', color: '#d1d5db', fontWeight: '500' }}>
              {flight.airline}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#9ca3af', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Aircraft Photo Card */}
      <div style={{ position: 'relative', width: '100%', height: '180px', overflow: 'hidden', background: '#090d16' }}>
        <img
          src={flight.photoUrl || 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&auto=format&fit=crop&q=80'}
          alt={flight.aircraftType}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(22,29,42,1) 0%, transparent 60%)' }} />

        <div style={{ position: 'absolute', bottom: '10px', left: '14px', right: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{flight.aircraftType}</div>
            <div style={{ fontSize: '11px', color: '#facc15', fontWeight: '600' }}>REG: {flight.registration || 'N800AN'} • ICAO: {flight.icao24}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Camera size={11} /> JetPhotos
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>


        {/* Flight Route Infographic Box (Flightradar24 Style) */}
        <div style={{ background: '#111722', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px solid var(--fr24-panel-border)' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            {/* Origin */}
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff', letterSpacing: '-0.02em' }}>{flight.origin?.code}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{flight.origin?.city}, {flight.origin?.country || 'N/A'}</div>
            </div>

            {/* Flight Path Graphic */}
            <div style={{ textAlign: 'center', flex: 1.5, padding: '0 8px' }}>
              <style>
                {`
                  @keyframes shineSweep {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                  }
                  .progress-shine {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
                    animation: shineSweep 2.5s infinite ease-in-out;
                  }
                  @keyframes pulseGlow {
                    0% { box-shadow: 0 0 8px #facc15; }
                    50% { box-shadow: 0 0 16px #facc15, 0 0 8px #fff; }
                    100% { box-shadow: 0 0 8px #facc15; }
                  }
                  @keyframes marchStripes {
                    from { background-position: 0 0; }
                    to { background-position: 20px 0; }
                  }
                  .track-remaining {
                    background-color: #222d40;
                    background-image: repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 4px,
                      rgba(255, 255, 255, 0.05) 4px,
                      rgba(255, 255, 255, 0.05) 8px
                    );
                    background-size: 20px 20px;
                    animation: marchStripes 4s linear infinite;
                  }
                `}
              </style>
              <div style={{ fontSize: '11px', color: '#facc15', fontWeight: '700', marginBottom: '4px' }}>{flight.progressPct}% COMPLETED</div>

              {/* The Track */}
              <div className="track-remaining" style={{ position: 'relative', width: '100%', height: '4px', borderRadius: '2px' }}>

                {/* The Filled Bar with overflow hidden for the shine */}
                <div style={{ width: `${flight.progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #facc15, #00b4d8)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
                  <div className="progress-shine" />
                </div>

                {/* The Airplane Icon (Placed absolute relative to the track, so it's not clipped by overflow) */}
                <div style={{
                  position: 'absolute',
                  top: '-6px',
                  left: `${flight.progressPct}%`,
                  transform: 'translateX(-50%)',
                  background: '#facc15',
                  padding: '2px',
                  borderRadius: '50%',
                  animation: 'pulseGlow 2s infinite',
                  zIndex: 10
                }}>
                  <Plane size={10} color="#000" style={{ transform: 'rotate(90deg)' }} />
                </div>
              </div>
            </div>

            {/* Destination */}
            <div style={{ textAlign: 'right', flex: 1 }}>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff', letterSpacing: '-0.02em' }}>{flight.destination?.code}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{flight.destination?.city}, {flight.destination?.country || 'N/A'}</div>
            </div>
          </div>

          {/* Schedule Times Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>
            <div>
              <span style={{ color: '#9ca3af' }}>STD: </span>
              <span style={{ color: '#fff', fontWeight: '600' }}>{flight.std || '19:30 UTC'}</span>
              <span style={{ color: '#10b981', marginLeft: '6px' }}>(ATD {flight.atd || '19:42'})</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#9ca3af' }}>STA: </span>
              <span style={{ color: '#fff', fontWeight: '600' }}>{flight.sta || '07:30 UTC'}</span>
              <span style={{ color: '#00b4d8', marginLeft: '6px' }}>(ETA {flight.eta || '07:18'})</span>
            </div>
          </div>

        </div>

        {/* Action Toolbar (Follow, 3D Cockpit HUD, Emergency) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <button
            className={following ? 'btn-fr24-yellow' : 'btn-secondary'}
            onClick={toggleFollow}
            style={{ fontSize: '12px', justifyContent: 'center' }}
          >
            <Crosshair size={14} /> {following ? 'Tracking Aircraft' : 'Follow Flight'}
          </button>

          <button
            className={show3DHud ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setShow3DHud(!show3DHud)}
            style={{ fontSize: '12px', justifyContent: 'center' }}
          >
            <Eye size={14} /> {show3DHud ? 'Hide 3D Cockpit' : '3D Cockpit HUD'}
          </button>
        </div>

        {/* 3D Horizon Cockpit HUD View Simulator Overlay */}
        {show3DHud && (
          <div style={{ background: '#090d16', border: '1px solid var(--fr24-cyan)', borderRadius: '10px', padding: '14px', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#00b4d8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} /> 3D ARTIFICIAL HORIZON COCKPIT HUD
            </div>

            {/* Artificial Horizon */}
            <div style={{ width: '100%', height: '140px', borderRadius: '6px', position: 'relative', overflow: 'hidden', border: '1px solid #1e3a5f', background: '#000' }}>
              {/* Pitch Animation Container */}
              <div style={{
                position: 'absolute',
                inset: '-40px',
                transform: `translateY(${Math.max(-30, Math.min(30, liveVrate / 40))}px)`,
                transition: 'transform 1s linear'
              }}>
                <style>
                  {`
                    @keyframes naturalRoll {
                      0% { transform: rotate(0deg); animation-timing-function: ease-in-out; }
                      13.33% { transform: rotate(25deg); }
                      20.00% { transform: rotate(25deg); animation-timing-function: ease-in-out; }
                      33.33% { transform: rotate(0deg); }
                      50.00% { transform: rotate(0deg); animation-timing-function: ease-in-out; }
                      63.33% { transform: rotate(-25deg); }
                      70.00% { transform: rotate(-25deg); animation-timing-function: ease-in-out; }
                      83.33% { transform: rotate(0deg); }
                      100% { transform: rotate(0deg); }
                    }
                  `}
                </style>
                <div style={{ position: 'absolute', inset: 0, animation: 'naturalRoll 30s infinite', animationDelay: randomRollDelay }}>
                  {/* Expand the background massively so rotation doesn't show edges */}
                  <div style={{ position: 'absolute', inset: '-100px', background: 'linear-gradient(180deg, #1a4fa0 0%, #2563eb 50%, #78350f 50%, #451a03 100%)' }} />
                  {[-10, -5, 0, 5, 10].map(p => (
                    <div key={p} style={{ position: 'absolute', left: p === 0 ? '10%' : '25%', width: p === 0 ? '80%' : '50%', height: '1px', background: p === 0 ? 'rgba(250,204,21,0.9)' : 'rgba(255,255,255,0.3)', top: `${50 + p * 3}%`, zIndex: 2 }}>
                      {p !== 0 && <span style={{ position: 'absolute', right: '-18px', top: '-5px', fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>{Math.abs(p)}</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '28px', height: '3px', background: '#facc15', borderRadius: '2px' }} />
                <div style={{ width: '8px', height: '8px', background: '#facc15', borderRadius: '50%', border: '2px solid #000', margin: '0 2px' }} />
                <div style={{ width: '28px', height: '3px', background: '#facc15', borderRadius: '2px' }} />
              </div>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '38px', background: 'rgba(0,0,0,0.78)', borderRight: '1px solid #1e3a5f', zIndex: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                {[-20, -10, 0, 10, 20].map(o => { const s = Math.round(speed + o); return s > 0 ? (<div key={o} style={{ fontSize: '9px', color: o === 0 ? '#10b981' : '#374151', fontWeight: o === 0 ? '800' : '400', lineHeight: '16px' }}>{s}</div>) : null; })}
                <div style={{ fontSize: '8px', color: '#10b981', marginTop: '2px' }}>KTS</div>
              </div>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '42px', background: 'rgba(0,0,0,0.78)', borderLeft: '1px solid #1e3a5f', zIndex: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                {[-200, -100, 0, 100, 200].map(o => { const a = Math.round((alt + o) / 100) * 100; return (<div key={o} style={{ fontSize: '9px', color: o === 0 ? '#00b4d8' : '#374151', fontWeight: o === 0 ? '800' : '400', lineHeight: '15px' }}>{a}</div>); })}
                <div style={{ fontSize: '8px', color: '#00b4d8', marginTop: '2px' }}>FT</div>
              </div>
            </div>

            {/* Compass */}
            <div style={{ marginTop: '8px', width: '100%', height: '36px', background: 'rgba(0,0,0,0.6)', border: '1px solid #1e3a5f', borderRadius: '4px', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 0, transform: `translateX(${-heading * (22 / 15)}px)`, transition: 'transform 1s ease-in-out' }}>
                {COMPASS_TICKS.map((tick) => (
                  <div key={tick.deg} style={{ position: 'absolute', left: `${tick.deg * (22 / 15)}px`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '22px', top: '6px' }}>
                    <div style={{ height: tick.isCardinal ? '8px' : '5px', width: '1px', background: tick.isCardinal ? '#facc15' : '#374151', marginBottom: '1px' }} />
                    <span style={{ fontSize: '8px', color: tick.isCardinal ? '#facc15' : '#6b7280', fontWeight: '700' }}>{tick.label}</span>
                  </div>
                ))}
              </div>
              {/* Fixed center tick marker */}
              <div style={{ position: 'absolute', top: 0, left: '50%', width: '2px', height: '12px', background: '#facc15', transform: 'translateX(-50%)', boxShadow: '0 0 4px #facc15' }} />
              {/* Heading readout */}
              <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', fontWeight: '800', color: '#facc15', background: 'rgba(0,0,0,0.85)', padding: '0 6px', borderRadius: '2px', letterSpacing: '0.05em' }}>{String(heading).padStart(3, '0')}°</div>
            </div>

            {/* Instruments Row */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.6)', border: '1px solid #1e3a5f', borderRadius: '4px', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="36" height="36" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#1e3a5f" strokeWidth="2.5" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke={vrate > 0 ? '#10b981' : vrate < 0 ? '#ef4444' : '#4b5563'}
                    strokeWidth="2.5" strokeDasharray={`${Math.min(Math.abs(vrate) / 3000 * 88, 88)} 88`}
                    strokeLinecap="round" transform="rotate(-90 18 18)" style={{ transition: 'stroke-dasharray 1s ease-in-out, stroke 1s' }} />
                  <line x1="18" y1="18" x2="18" y2="6" stroke="#facc15" strokeWidth="2" strokeLinecap="round"
                    transform={`rotate(${Math.max(-150, Math.min(150, vrate / 3000 * 150))} 18 18)`} style={{ transition: 'transform 1s ease-in-out' }} />
                  <circle cx="18" cy="18" r="2.5" fill="#facc15" />
                </svg>
                <div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>VERT SPEED</div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: vrate > 0 ? '#10b981' : vrate < 0 ? '#ef4444' : '#9ca3af' }}>{vrate > 0 ? '+' : ''}{vrate}<span style={{ fontSize: '8px' }}> fpm</span></div>
                </div>
              </div>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.6)', border: '1px solid #1e3a5f', borderRadius: '4px', padding: '6px 8px' }}>
                <div style={{ fontSize: '9px', color: '#6b7280', marginBottom: '2px' }}>MACH</div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#00b4d8' }}>M{(speed / 666).toFixed(2)}</div>
                <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>GS: <span style={{ color: '#facc15' }}>{speed} KT</span></div>
              </div>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.6)', border: '1px solid #1e3a5f', borderRadius: '4px', padding: '6px 8px' }}>
                <div style={{ fontSize: '9px', color: '#6b7280', marginBottom: '4px' }}>ENG N1</div>
                {[0, 1].map(i => {
                  const n1 = 85 + i + Math.round(Math.sin(Date.now() / (2000 + i * 700)) * 1.5); return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '8px', color: '#6b7280', width: '8px' }}>{i + 1}</span>
                      <div style={{ flex: 1, height: '5px', background: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${n1}%`, height: '100%', background: n1 > 90 ? '#ef4444' : '#10b981', transition: 'width 1s ease-in-out' }} />
                      </div>
                      <span style={{ fontSize: '8px', color: '#10b981', width: '22px' }}>{n1}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Telemetry Data Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <div style={{ background: '#111722', padding: '10px', borderRadius: '8px', border: '1px solid var(--fr24-panel-border)' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase' }}>Calibrated Altitude</div>
            <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: getAltitudeColor(alt) }}>
              {formatAltitude(alt)} <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>({Math.round(alt * 0.3048)} m)</span>
            </div>
          </div>

          <div style={{ background: '#111722', padding: '10px', borderRadius: '8px', border: '1px solid var(--fr24-panel-border)' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase' }}>Ground Speed</div>
            <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: '#00b4d8' }}>
              {speed} kts <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>({Math.round(speed * 1.852)} km/h)</span>
            </div>
          </div>

          <div style={{ background: '#111722', padding: '10px', borderRadius: '8px', border: '1px solid var(--fr24-panel-border)' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase' }}>Track Heading</div>
            <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: '#facc15' }}>
              {heading}°
            </div>
          </div>

          <div style={{ background: '#111722', padding: '10px', borderRadius: '8px', border: '1px solid var(--fr24-panel-border)' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase' }}>Vertical Speed</div>
            <div className="font-mono-hud" style={{ fontSize: '15px', fontWeight: '700', color: vrate < 0 ? '#ef4444' : vrate > 0 ? '#10b981' : '#9ca3af' }}>
              {vrate > 0 ? `+${vrate}` : vrate} fpm
            </div>
          </div>
        </div>

        {/* Position & ADS-B Metadata Footer */}
        <div style={{ background: '#111722', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--fr24-panel-border)', fontSize: '11px', color: '#9ca3af', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>LAT / LON:</span>
            <span className="font-mono-hud" style={{ color: '#fff' }}>{lat ? lat.toFixed(4) : 0}°, {lon ? lon.toFixed(4) : 0}°</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>TRANSPONDER SQUAWK:</span>
            <span className="font-mono-hud" style={{ color: squawkBadge.isEmergency ? '#ef4444' : '#10b981', fontWeight: '700' }}>{squawkBadge.label}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>RADAR FEED SOURCE:</span>
            <span className="font-mono-hud" style={{ color: '#00b4d8' }}>{flight.radarSource || 'F-KJFK1'} (ADS-B)</span>
          </div>
        </div>


      </div>

    </aside>
  );
}
