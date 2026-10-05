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
const MAX_PLANES = 500;

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
  const options = { timeout: 25000 };
  if (process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD) {
    const auth = Buffer.from(`${process.env.OPENSKY_USERNAME}:${process.env.OPENSKY_PASSWORD}`).toString('base64');
    options.headers = { 'Authorization': `Basic ${auth}` };
  }
  return new Promise((resolve, reject) => {
    const req = https.get(url, options, res => {
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
    this.targetIcaos  = new Set();  // icao24 → tracked subset
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

      // Parse and filter valid flights
      const parsed = data.states.map(sv => this._parseState(sv)).filter(Boolean);
      
      // Remove stale targets that are no longer in the global feed
      const activeGlobalIcaos = new Set(parsed.map(p => p.icao24));
      for (const id of this.targetIcaos) {
        if (!activeGlobalIcaos.has(id)) this.targetIcaos.delete(id);
      }

      // If we don't have enough tracked targets, pick new ones to fill up to MAX_PLANES
      if (this.targetIcaos.size < MAX_PLANES) {
        const available = parsed.filter(p => !this.targetIcaos.has(p.icao24));
        // Shuffle available
        for (let i = available.length-1; i>0; i--) {
          const j = Math.floor(Math.random()*(i+1));
          [available[i],available[j]] = [available[j],available[i]];
        }
        const needed = MAX_PLANES - this.targetIcaos.size;
        const newTargets = available.slice(0, needed);
        for (const p of newTargets) this.targetIcaos.add(p.icao24);
      }

      // Filter parsed data to ONLY include our tracked targets
      const sample = parsed.filter(p => this.targetIcaos.has(p.icao24));

      const seen = new Set(sample.map(p => p.icao24));
      for (const p of sample) this.liveAircraft.set(p.icao24, { ...p });
      for (const id of this.liveAircraft.keys()) if (!seen.has(id)) this.liveAircraft.delete(id);

      if (this.usingFallback) {
        adsbSimulator.stopSimulation();
        this.usingFallback = false;
        console.log('✅ OpenSky rate-limit lifted — switched back to real data');
      }

      const events = [...this.liveAircraft.values()].map(ac => this._toEvent(ac));

      // Inject global simulated flights to populate remote regions
      adsbSimulator.tick(); // manually step the physics for simulator
      const simFlights = adsbSimulator.getCurrentFlights();
      events.push(...simFlights);

      console.log(`🛫 OpenSky poll #${this.fetchCount} → ${events.length} total aircraft (${events.length - simFlights.length} real, ${simFlights.length} sim)`);
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
