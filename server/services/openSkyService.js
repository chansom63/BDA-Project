/**
 * OpenSky Network Real-Time ADS-B Feed
 * -------------------------------------
 * Fetches live flight positions from https://opensky-network.org/api/states/all
 * and emits them in the same telemetry_batch format as the simulator,
 * so the entire existing Kinesis → MongoDB → WebSocket pipeline works unchanged.
 *
 * Free, no API key required (anonymous: 100 req/10 min limit).
 * Polls every POLL_INTERVAL_MS (default 5 s) to simulate high-velocity streaming.
 */

const EventEmitter = require('events');
const https = require('https');

// ── Configuration ──────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5000;   // 5-second polling interval
const MAX_AIRCRAFT     = 200;   // How many aircraft to show (randomly sampled for global spread)

// ── Known airline prefixes → full name mapping (best-effort) ──────────────────
const AIRLINE_MAP = {
  AAL: 'American Airlines',   UAL: 'United Airlines',    DAL: 'Delta Air Lines',
  BAW: 'British Airways',     DLH: 'Lufthansa',          AFR: 'Air France',
  UAE: 'Emirates',            KLM: 'KLM Royal Dutch',    SWR: 'Swiss Air',
  IBE: 'Iberia',              RYR: 'Ryanair',            EZY: 'easyJet',
  SIA: 'Singapore Airlines',  QFA: 'Qantas',             JAL: 'Japan Airlines',
  ANA: 'All Nippon Airways',  CPA: 'Cathay Pacific',     THY: 'Turkish Airlines',
  SVA: 'Saudi Arabian Airlines', ETH: 'Ethiopian Airlines', QTR: 'Qatar Airways',
  VIR: 'Virgin Atlantic',     NKS: 'Spirit Airlines',    ASA: 'Alaska Airlines',
  SWA: 'Southwest Airlines',  FDX: 'FedEx',              UPS: 'UPS Airlines',
};

function guessAirline(callsign) {
  if (!callsign) return 'Unknown Airline';
  const prefix = callsign.replace(/[0-9]/g, '').trim().toUpperCase().substring(0, 3);
  return AIRLINE_MAP[prefix] || callsign.substring(0, 3).toUpperCase() + ' Airways';
}

function guessAircraftType(icao24) {
  const types = [
    'Boeing 737-800', 'Boeing 737 MAX 8', 'Boeing 777-300ER', 'Boeing 787-9 Dreamliner',
    'Airbus A320neo', 'Airbus A321neo', 'Airbus A330-300', 'Airbus A350-900', 'Airbus A380-800',
    'Boeing 747-8i', 'Embraer E190', 'Bombardier CRJ-900'
  ];
  // deterministic per aircraft so it doesn't change each poll
  const idx = parseInt(icao24.substring(0, 2), 16) % types.length;
  return types[idx];
}

function squawkStatus(squawk) {
  if (['7700', '7600', '7500'].includes(squawk)) return 'Emergency';
  return 'In-Flight';
}

// ── HTTP helper ────────────────────────────────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode === 429) return reject(new Error('OpenSky rate-limit (429)'));
      if (res.statusCode !== 200) return reject(new Error('OpenSky HTTP ' + res.statusCode));
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('OpenSky JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenSky request timeout')); });
  });
}

// ── Main service ───────────────────────────────────────────────────────────────
class OpenSkyService extends EventEmitter {
  constructor() {
    super();
    this.intervalId   = null;
    this.isRunning    = false;
    this.lastBatch    = [];
    this.trajectories = new Map();  // icao24 → [{lat,lon,altitudeFt,...}]
    this.aircraftMeta = new Map();  // icao24 → {airline, aircraftType, registration}
    this.fetchCount   = 0;
  }

  // OpenSky state vector indices:
  // [icao24, callsign, origin_country, time_pos, last_contact,
  //  lon, lat, baro_alt, on_ground, velocity,
  //  true_track, vert_rate, sensors, geo_alt, squawk, spi, pos_source]
  _parseState(sv) {
    const icao24      = sv[0];
    const rawCallsign = sv[1];
    const originCountry = sv[2];
    const lon         = sv[5];
    const lat         = sv[6];
    const baroAlt     = sv[7];
    const onGround    = sv[8];
    const velocity    = sv[9];
    const trueTrack   = sv[10];
    const vertRate    = sv[11];
    const geoAlt      = sv[13];
    const squawk      = sv[14];

    if (!lat || !lon || onGround) return null;
    // No geographic filter — accept aircraft from anywhere in the world


    const callsign = (rawCallsign || '').trim() || icao24.toUpperCase();
    const altFt    = Math.round(((geoAlt || baroAlt || 9144) * 3.28084));
    const speedKts = velocity ? Math.round(velocity * 1.94384) : 450;
    const hdg      = Math.round(trueTrack || 0);
    const vr       = vertRate ? Math.round(vertRate * 196.85) : 0;
    const sq       = squawk   ? String(squawk).padStart(4, '0') : '1200';

    return { icao24, callsign, originCountry, lat, lon, altFt, speedKts, hdg, vr, sq };
  }

  _buildTelemetryEvent(parsed) {
    const { icao24, callsign, originCountry, lat, lon, altFt, speedKts, hdg, vr, sq } = parsed;

    if (!this.aircraftMeta.has(icao24)) {
      this.aircraftMeta.set(icao24, {
        airline:      guessAirline(callsign),
        aircraftType: guessAircraftType(icao24),
        registration: icao24.toUpperCase(),
      });
    }
    const meta = this.aircraftMeta.get(icao24);

    if (!this.trajectories.has(icao24)) this.trajectories.set(icao24, []);
    const traj = this.trajectories.get(icao24);
    traj.push({ lat, lon, altitudeFt: altFt, speedKnots: speedKts, timestamp: new Date() });
    if (traj.length > 30) traj.shift();

    return {
      eventId:         'opensky_' + Date.now() + '_' + icao24,
      timestamp:       new Date().toISOString(),
      icao24,
      callsign,
      flightId:        icao24.toUpperCase(),
      airline:         meta.airline,
      aircraftType:    meta.aircraftType,
      registration:    meta.registration,
      countryFlag:     '🌍',
      radarSource:     'OpenSky-ADS-B-' + (originCountry || 'Global'),
      photoUrl:        'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&auto=format&fit=crop&q=80',
      origin:      { code: 'LIVE', city: originCountry || 'Unknown', country: originCountry || 'Unknown', lat, lon },
      destination: { code: 'LIVE', city: 'En Route', country: '?', lat, lon },
      latitude:        lat,
      longitude:       lon,
      altitudeFt:      altFt,
      speedKnots:      speedKts,
      headingDeg:      hdg,
      verticalRateFpm: vr,
      squawk:          sq,
      status:          squawkStatus(sq),
      progressPct:     50,
      weatherTurbulence: 'None',
      trajectory:      [...traj],
      std: '--:-- UTC', atd: '--:-- UTC', sta: '--:-- UTC', eta: '--:-- UTC',
    };
  }

  async _poll() {
    // Fetch ALL global aircraft (no bounding box) for worldwide spread
    const url = 'https://opensky-network.org/api/states/all';
    try {
      const data = await fetchJSON(url);
      if (!data || !Array.isArray(data.states)) {
        console.warn('OpenSky: empty response, keeping last batch');
        return;
      }
      this.fetchCount++;

      // Parse all valid airborne states
      const allParsed = data.states
        .map(sv => this._parseState(sv))
        .filter(Boolean);

      // Group aircraft into 20x20 degree geographical grid buckets to prevent 
      // dense regions (US/Europe) from dominating the sample
      const buckets = new Map();
      allParsed.forEach(p => {
        const gridKey = Math.floor(p.lat / 20) + '_' + Math.floor(p.lon / 20);
        if (!buckets.has(gridKey)) buckets.set(gridKey, []);
        buckets.get(gridKey).push(p);
      });

      // Shuffle aircraft within each bucket
      for (const list of buckets.values()) {
        for (let i = list.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [list[i], list[j]] = [list[j], list[i]];
        }
      }

      // Pick aircraft round-robin from each bucket to get an even global spread
      const selectedParsed = [];
      let added = true;
      let idx = 0;
      while (selectedParsed.length < MAX_AIRCRAFT && added) {
        added = false;
        for (const list of buckets.values()) {
          if (idx < list.length) {
            selectedParsed.push(list[idx]);
            added = true;
            if (selectedParsed.length >= MAX_AIRCRAFT) break;
          }
        }
        idx++;
      }

      const events = selectedParsed
        .map(p => this._buildTelemetryEvent(p));

      if (events.length > 0) {
        this.lastBatch = events;
        console.log('🛫 OpenSky → ' + events.length + ' live aircraft worldwide | poll #' + this.fetchCount);
        this.emit('telemetry_batch', events);
      }
    } catch (err) {
      console.warn('OpenSky fetch error: ' + err.message + ' — using cached batch (' + this.lastBatch.length + ' aircraft)');
      if (this.lastBatch.length > 0) this.emit('telemetry_batch', this.lastBatch);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._poll();
    this.intervalId = setInterval(() => this._poll(), POLL_INTERVAL_MS);
    console.log('🌍 OpenSky Network ADS-B feed STARTED — polling real aircraft every ' + (POLL_INTERVAL_MS / 1000) + 's');
  }

  stop() {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.isRunning = false;
    console.log('OpenSky Network feed STOPPED');
  }
}

module.exports = new OpenSkyService();
