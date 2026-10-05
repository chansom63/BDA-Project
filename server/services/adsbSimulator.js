const EventEmitter = require('events');

function calculateHeading(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function haversineNM(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

class ADSBTelemetrySimulator extends EventEmitter {
  constructor() {
    super();
    this.intervalId     = null;
    this.speedMultiplier = 1.0;
    this.isRunning      = false;

    // ── 40+ global airports ──────────────────────────────────────────────────
    const AIRPORTS = [
      // Upper & Remote Regions (Northern Hemisphere ONLY)
      { code:'ANC', city:'Anchorage',     country:'USA',         lat:61.1743,  lon:-149.9962 },
      { code:'KEF', city:'Reykjavik',     country:'Iceland',     lat:63.9850,  lon:-22.6056  },
      { code:'SVO', city:'Moscow',        country:'Russia',      lat:55.9726,  lon:37.4146   },
      { code:'YVR', city:'Vancouver',     country:'Canada',      lat:49.1967,  lon:-123.1815 },
      { code:'HEL', city:'Helsinki',      country:'Finland',     lat:60.3172,  lon:24.9633   },
      { code:'OSL', city:'Oslo',          country:'Norway',      lat:60.2028,  lon:11.0835   },
      { code:'OVB', city:'Novosibirsk',   country:'Russia',      lat:55.0126,  lon:82.6507   },
      { code:'YEG', city:'Edmonton',      country:'Canada',      lat:53.3097,  lon:-113.5797 },
      { code:'YWG', city:'Winnipeg',      country:'Canada',      lat:49.9100,  lon:-97.2399  },
      { code:'YHZ', city:'Halifax',       country:'Canada',      lat:44.8808,  lon:-63.5086  },
      { code:'TOS', city:'Tromso',        country:'Norway',      lat:69.6833,  lon:18.9189   },
      { code:'KUF', city:'Samara',        country:'Russia',      lat:53.5048,  lon:50.1633   },
      { code:'YFB', city:'Iqaluit',       country:'Canada',      lat:63.7503,  lon:-68.5558  },
      { code:'LYR', city:'Svalbard',      country:'Norway',      lat:78.2461,  lon:15.4656   }
    ];

    const AIRLINES = [
      {name:'American Airlines',  cs:'AAL', flag:'🇺🇸'},
      {name:'Delta Air Lines',    cs:'DAL', flag:'🇺🇸'},
      {name:'United Airlines',    cs:'UAL', flag:'🇺🇸'},
      {name:'British Airways',    cs:'BAW', flag:'🇬🇧'},
      {name:'Lufthansa',          cs:'DLH', flag:'🇩🇪'},
      {name:'Air France',         cs:'AFR', flag:'🇫🇷'},
      {name:'Emirates',           cs:'UAE', flag:'🇦🇪'},
      {name:'Qatar Airways',      cs:'QTR', flag:'🇶🇦'},
      {name:'Singapore Airlines', cs:'SIA', flag:'🇸🇬'},
      {name:'Cathay Pacific',     cs:'CPA', flag:'🇭🇰'},
      {name:'Japan Airlines',     cs:'JAL', flag:'🇯🇵'},
      {name:'Air Canada',         cs:'ACA', flag:'🇨🇦'},
      {name:'KLM',                cs:'KLM', flag:'🇳🇱'},
      {name:'Turkish Airlines',   cs:'THY', flag:'🇹🇷'},
      {name:'Qantas',             cs:'QFA', flag:'🇦🇺'},
      {name:'Ethiopian Airlines', cs:'ETH', flag:'🇪🇹'},
      {name:'LATAM Airlines',     cs:'LAN', flag:'🇧🇷'},
      {name:'Air India',          cs:'AIC', flag:'🇮🇳'},
      {name:'Korean Air',         cs:'KAL', flag:'🇰🇷'},
      {name:'China Southern',     cs:'CSN', flag:'🇨🇳'},
    ];
    const TYPES = [
      'Boeing 737-800','Boeing 737 MAX 8','Boeing 777-300ER','Boeing 787-9 Dreamliner',
      'Airbus A320neo','Airbus A321neo',  'Airbus A330-300', 'Airbus A350-900',
      'Airbus A380-800','Boeing 747-8i',  'Embraer E190',    'Bombardier CRJ-900',
    ];

    // Store airports for MapView pin display
    this.airports = AIRPORTS;

    // ── Generate 500 globally spread flights ──────────────────────────────────
    this.flights = [];
    for (let i = 0; i < 500; i++) {
      const al   = AIRLINES[i % AIRLINES.length];
      
      // Generate completely random coordinates in the northern hemisphere (Lat: 45 to 85)
      const origLat = 45 + Math.random() * 40;
      const origLon = -180 + Math.random() * 360;
      const destLat = 45 + Math.random() * 40;
      const destLon = -180 + Math.random() * 360;
      
      // Use random airports for the UI labels, but use random coords for actual position
      const origAirport = AIRPORTS[Math.floor(Math.random() * AIRPORTS.length)];
      const destAirport = AIRPORTS[Math.floor(Math.random() * AIRPORTS.length)];

      const pct  = Math.random(); // 0 to 1
      const lat  = origLat + (destLat - origLat) * pct;
      const lon  = origLon + (destLon - origLon) * pct;
      const hdg  = calculateHeading(lat, lon, destLat, destLon);
      
      this.flights.push({
        flightId:        al.cs + (100 + i),
        callsign:        al.cs + (100 + i),
        airline:         al.name,
        aircraftType:    TYPES[i % TYPES.length],
        registration:    al.cs.charAt(0) + '-' + Math.floor(Math.random()*9000+1000),
        countryFlag:     al.flag,
        photoUrl:        'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&auto=format&fit=crop&q=80',
        origin:          { code:origAirport.code, city:origAirport.city, country:origAirport.country, lat:origLat, lon:origLon },
        destination:     { code:destAirport.code, city:destAirport.city, country:destAirport.country, lat:destLat, lon:destLon },
        std:'--:-- UTC', atd:'--:-- UTC', sta:'--:-- UTC', eta:'--:-- UTC',
        radarSource:     'SIM-ADS-B-' + origAirport.code,
        icao24:          Math.floor(Math.random()*0xFFFFFF).toString(16).padStart(6,'0'),
        lat, lon,
        altitudeFt:      30000 + (i % 12) * 1000,
        speedKnots:      430 + (i % 8) * 10,
        headingDeg:      hdg,
        verticalRateFpm: 0,
        squawk:          '1200',
        status:          'In-Flight',
        progressPct:     pct,
        weatherTurbulence: 'None',
        trajectory:      [{ lat, lon, altitudeFt: 30000 + (i%12)*1000, speedKnots: 430+(i%8)*10, timestamp: new Date() }]
      });
    }
  }

  tick() {
    const dtHours = (20 / 3600) * this.speedMultiplier; // 20s tick

    this.flights.forEach(f => {
      const hdg = calculateHeading(f.lat, f.lon, f.destination.lat, f.destination.lon);
      f.headingDeg = hdg;
      const dist = f.speedKnots * dtHours;
      const hdRad = hdg * Math.PI / 180;
      f.lat += (dist / 60) * Math.cos(hdRad);
      f.lon += (dist / 60) * Math.sin(hdRad) / (Math.cos(f.lat * Math.PI / 180) || 0.001);

      if (f.verticalRateFpm !== 0) {
        f.altitudeFt += f.verticalRateFpm * (20/60) * this.speedMultiplier;
        if (f.altitudeFt <= 5000) f.verticalRateFpm = 0;
      }

      const totalDist = haversineNM(f.origin.lat, f.origin.lon, f.destination.lat, f.destination.lon);
      const remDist   = haversineNM(f.lat, f.lon, f.destination.lat, f.destination.lon);
      f.progressPct   = Math.min(100, Math.max(0, Math.round(((totalDist - remDist) / totalDist) * 100)));

      if (remDist < 20) {
        f.lat = f.origin.lat; f.lon = f.origin.lon;
        f.altitudeFt = 35000; f.status = 'In-Flight'; f.progressPct = 0; f.trajectory = [];
      }

      if (f.trajectory.length > 40) f.trajectory.shift();
      f.trajectory.push({ lat:f.lat, lon:f.lon, altitudeFt:f.altitudeFt, speedKnots:f.speedKnots, timestamp:new Date() });

      // Build telemetry event
      f._event = {
        eventId: 'sim_' + Date.now() + '_' + f.icao24,
        timestamp: new Date().toISOString(),
        icao24: f.icao24, callsign: f.callsign, flightId: f.flightId,
        airline: f.airline, aircraftType: f.aircraftType, registration: f.registration,
        countryFlag: f.countryFlag, radarSource: f.radarSource, photoUrl: f.photoUrl,
        origin: f.origin, destination: f.destination,
        latitude: f.lat, longitude: f.lon, altitudeFt: Math.round(f.altitudeFt),
        speedKnots: f.speedKnots, headingDeg: Math.round(f.headingDeg),
        verticalRateFpm: f.verticalRateFpm, squawk: f.squawk, status: f.status,
        progressPct: f.progressPct, weatherTurbulence: f.weatherTurbulence,
        trajectory: [...f.trajectory],
        std: f.std, atd: f.atd, sta: f.sta, eta: f.eta,
      };
    });

    const telemetryEvents = this.flights.map(f => f._event);
    this.emit('telemetry_batch', telemetryEvents);
    // Produce to real Kafka broker
    const kafkaService = require('./kafkaService');
    kafkaService.produceTelemetryBatch(telemetryEvents).catch(console.error);
  }

  startSimulation(intervalMs = 20000) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), intervalMs);
    console.log('📡 ADS-B Telemetry Generator service STARTED (Simulated MSK Ingestion active)');
  }

  stopSimulation() {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.isRunning = false;
    console.log('⏹️ ADS-B Telemetry Generator service STOPPED');
  }

  setSpeedMultiplier(m) { this.speedMultiplier = Math.max(0.1, Math.min(20, m)); }

  getCurrentFlights() { return this.flights.map(f => f._event || f); }

  triggerEmergency(flightId, squawkCode = '7700') {
    const flight = this.flights.find(f => f.flightId === flightId);
    if (flight) {
      flight.squawk = squawkCode;
      flight.status = 'Emergency';
      flight.verticalRateFpm = -1500;
      flight.weatherTurbulence = 'Severe';
      return flight;
    }
    return null;
  }

  setSquawk(flightId, squawkCode) {
    const flight = this.flights.find(f => f.flightId === flightId);
    if (flight) {
      flight.squawk = squawkCode;
      if (['7700', '7600', '7500'].includes(squawkCode)) {
        flight.status = 'Emergency';
      } else {
        flight.status = 'In-Flight';
        flight.verticalRateFpm = 0;
      }
      return flight;
    }
    return null;
  }

  injectCustomFlight(flightData) {
    const newFlight = {
      flightId: flightData.flightId || `FL${Math.floor(100 + Math.random() * 900)}`,
      icao24: flightData.icao24 || Math.random().toString(16).substring(2, 8).toUpperCase(),
      callsign: flightData.callsign || `CS${Math.floor(100 + Math.random() * 900)}`,
      airline: flightData.airline || 'Skyways Express',
      aircraftType: flightData.aircraftType || 'Airbus A320neo',
      registration: flightData.registration || `N${Math.floor(100 + Math.random() * 900)}SK`,
      countryFlag: '🇺🇸',
      photoUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&auto=format&fit=crop&q=80',
      origin: flightData.origin || { code: 'SFO', city: 'San Francisco', country: 'USA', lat: 37.6213, lon: -122.3790 },
      destination: flightData.destination || { code: 'ORD', city: 'Chicago', country: 'USA', lat: 41.9742, lon: -87.9073 },
      std: '18:00 UTC', atd: '18:10 UTC', sta: '23:30 UTC', eta: '23:20 UTC',
      radarSource: 'F-KSFO2',
      lat: flightData.lat || 38.0,
      lon: flightData.lon || -100.0,
      altitudeFt: flightData.altitudeFt || 33000,
      speedKnots: flightData.speedKnots || 450,
      headingDeg: flightData.headingDeg || 80,
      verticalRateFpm: 0,
      squawk: flightData.squawk || '1200',
      status: flightData.status || 'In-Flight',
      progressPct: 10,
      weatherTurbulence: 'None',
      trajectory: []
    };
    this.flights.push(newFlight);
    return newFlight;
  }
}

module.exports = new ADSBTelemetrySimulator();
