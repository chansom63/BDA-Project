/**
 * OpenSky Network Real-Time ADS-B Feed
 * ─────────────────────────────────────
 * • Anonymous access — no credentials needed
 * • Polls every 20s → 3 req/min → 30 req/10min  (limit: 100/10min, 70 headroom)
 * • Respects Retry-After header on 429 — never hammers while banned
 * • Falls back to ADS-B simulator seamlessly while waiting
 * • Client-side requestAnimationFrame handles all smooth animation between polls
 */

const EventEmitter = require('events');
const https        = require('https');
const adsbSimulator = require('./adsbSimulator');

const POLL_MS    = 20000;   // 20s → 30 req/10min, well under anonymous 100/10min limit
const MAX_PLANES = 200;

// ── Airline map ───────────────────────────────────────────────────────────────
const AIRLINE_MAP = {
  AAL:'American Airlines', UAL:'United Airlines',  DAL:'Delta Air Lines',
  BAW:'British Airways',   DLH:'Lufthansa',        AFR:'Air France',
  UAE:'Emirates',          KLM:'KLM Royal Dutch',  SWR:'SWISS',
  IBE:'Iberia',            RYR:'Ryanair',          EZY:'easyJet',
  SIA:'Singapore Airlines',QFA:'Qantas',           JAL:'Japan Airlines',
  ANA:'All Nippon Airways',CPA:'Cathay Pacific',   THY:'Turkish Airlines',
  QTR:'Qatar Airways',     ETH:'Ethiopian Airlines',FDX:'FedEx',
};
const TYPES = [
  'Boeing 737-800','Boeing 737 MAX 8','Boeing 777-300ER','Boeing 787-9',
  'Airbus A320neo','Airbus A321neo',  'Airbus A330-300', 'Airbus A350-900',
  'Airbus A380-800','Boeing 747-8i',  'Embraer E190',    'Bombardier CRJ-900',
];

function airline(cs) {
  if (!cs) return 'Unknown Airline';
  const p = cs.replace(/\d/g,'').trim().toUpperCase().slice(0,3);
  return AIRLINE_MAP[p] || cs.slice(0,3).toUpperCase() + ' Airways';
}
function acType(icao24) { return TYPES[parseInt(icao24.slice(0,2),16) % TYPES.length]; }

// ── Dead-reckoning (server-side, keeps liveAircraft map current) ─────────────
function deadReckon(ac, dtSec) {
  const dist  = ac.speedKnots * dtSec / 3600;
  const hdRad = ac.headingDeg * Math.PI / 180;
  const latR  = ac.lat * Math.PI / 180;
  ac.lat += (dist / 60) * Math.cos(hdRad);
  ac.lon += (dist / 60) * Math.sin(hdRad) / (Math.cos(latR) || 0.001);
  ac.altitudeFt = Math.min(45000, Math.max(500, ac.altitudeFt + ac.verticalRateFpm * dtSec / 60));
}

// ── HTTP fetch — reads Retry-After on 429 ────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 25000 }, res => {
      if (res.statusCode === 429) {
        const retryAfter = parseInt(res.headers['retry-after'] || '600', 10);
        return reject(Object.assign(new Error('rate-limited'), { retryAfter }));
      }
      if (res.statusCode !== 200)
        return reject(new Error('HTTP ' + res.statusCode));
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch(e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Service ───────────────────────────────────────────────────────────────────
class OpenSkyService extends EventEmitter {
  constructor() {
    super();
    this.pollTimer    = null;
    this.isRunning    = false;
    this.usingFallback = false;
    this.resumeAt     = 0;          // epoch ms — don't poll before this
    this.fetchCount   = 0;
    this.liveAircraft = new Map();  // icao24 → mutable state
    this.meta         = new Map();  // icao24 → {airline, type, reg}
    this.trajectories = new Map();  // icao24 → [{lat,lon,...}]
  }

  _parseState(sv) {
    const [icao24, cs, country,,, lon, lat, baro,, vel, trk, vr,, geo, sq] = sv;
    if (!lat || !lon || sv[8]) return null;   // skip on-ground / no-pos
    return {
      icao24, callsign:(cs||'').trim()||icao24.toUpperCase(),
      originCountry: country||'Unknown',
      lat, lon,
      altitudeFt:      Math.round((geo||baro||9000)*3.28084),
      speedKnots:      vel  ? Math.round(vel*1.94384) : 450,
      headingDeg:      Math.round(trk||0),
      verticalRateFpm: vr   ? Math.round(vr*196.85)  : 0,
      squawk:          sq   ? String(sq).padStart(4,'0') : '1200',
    };
  }

  _toEvent(ac) {
    const { icao24, callsign, originCountry, lat, lon,
            altitudeFt, speedKnots, headingDeg, verticalRateFpm, squawk } = ac;
    if (!this.meta.has(icao24))
      this.meta.set(icao24, { airline:airline(callsign), type:acType(icao24), reg:icao24.toUpperCase() });
    const m = this.meta.get(icao24);
    if (!this.trajectories.has(icao24)) this.trajectories.set(icao24, []);
    const traj = this.trajectories.get(icao24);
    traj.push({ lat, lon, altitudeFt, speedKnots, timestamp: new Date() });
    if (traj.length > 40) traj.shift();
    return {
      eventId:`opensky_${Date.now()}_${icao24}`, timestamp:new Date().toISOString(),
      icao24, callsign, flightId:icao24.toUpperCase(),
      airline:m.airline, aircraftType:m.type, registration:m.reg,
      countryFlag:'🌍', radarSource:'OpenSky-ADS-B-'+originCountry,
      photoUrl:'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&auto=format&fit=crop&q=80',
      origin:      { code:'LIVE', city:originCountry, country:originCountry, lat, lon },
      destination: { code:'LIVE', city:'En Route',    country:'?',          lat, lon },
      latitude:lat, longitude:lon, altitudeFt:Math.round(altitudeFt),
      speedKnots, headingDeg, verticalRateFpm, squawk,
      status:['7700','7600','7500'].includes(squawk)?'Emergency':'In-Flight',
      progressPct:50, weatherTurbulence:'None', trajectory:[...traj],
      std:'--:-- UTC', atd:'--:-- UTC', sta:'--:-- UTC', eta:'--:-- UTC',
    };
  }

  async _poll() {
    // Respect Retry-After from last 429
    if (Date.now() < this.resumeAt) {
      const waitMin = Math.ceil((this.resumeAt - Date.now()) / 60000);
      console.log(`⏸  OpenSky: waiting ${waitMin}m more before retrying (Retry-After)`);
      return;
    }

    try {
      const data = await fetchJSON('https://opensky-network.org/api/states/all');
      if (!data?.states) return;

      this.fetchCount++;

      // Parse, shuffle for global spread, cap at MAX_PLANES
      const parsed = data.states.map(sv => this._parseState(sv)).filter(Boolean);
      for (let i = parsed.length-1; i>0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [parsed[i],parsed[j]] = [parsed[j],parsed[i]];
      }
      const sample = parsed.slice(0, MAX_PLANES);

      const seen = new Set(sample.map(p => p.icao24));
      for (const p of sample) this.liveAircraft.set(p.icao24, { ...p });
      for (const id of this.liveAircraft.keys()) if (!seen.has(id)) this.liveAircraft.delete(id);

      if (this.usingFallback) {
        adsbSimulator.stopSimulation();
        this.usingFallback = false;
        console.log('✅ OpenSky rate-limit lifted — switched back to real data');
      }

      const events = [...this.liveAircraft.values()].map(ac => this._toEvent(ac));
      console.log(`🛫 OpenSky poll #${this.fetchCount} → ${events.length} real aircraft (anonymous, ${POLL_MS/1000}s interval)`);
      this.emit('telemetry_batch', events);

    } catch (err) {
      if (err.message === 'rate-limited') {
        const waitSec = err.retryAfter || 600;
        this.resumeAt = Date.now() + waitSec * 1000;
        console.warn(`⚠️  OpenSky 429 — will retry in ${Math.ceil(waitSec/60)} min (Retry-After: ${waitSec}s). Simulator active.`);
        if (!this.usingFallback) {
          this.usingFallback = true;
          if (!adsbSimulator.isRunning) adsbSimulator.startSimulation(20000);
        }
      } else {
        console.warn('OpenSky error:', err.message);
      }
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._poll();
    this.pollTimer = setInterval(() => this._poll(), POLL_MS);
    console.log(`🌍 OpenSky ADS-B STARTED — anonymous, polling every ${POLL_MS/1000}s (${POLL_MS/1000*3}/10min of 100 allowed)`);
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.isRunning = false;
    adsbSimulator.stopSimulation();
  }
}

module.exports = new OpenSkyService();
