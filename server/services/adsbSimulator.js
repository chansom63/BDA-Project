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
      // North America
      { code:'JFK', city:'New York',      country:'USA',         lat:40.6413,  lon:-73.7781  },
      { code:'LAX', city:'Los Angeles',   country:'USA',         lat:33.9416,  lon:-118.4085 },
      { code:'ORD', city:'Chicago',       country:'USA',         lat:41.9742,  lon:-87.9073  },
      { code:'MIA', city:'Miami',         country:'USA',         lat:25.7959,  lon:-80.2870  },
      { code:'SFO', city:'San Francisco', country:'USA',         lat:37.6213,  lon:-122.3790 },
      { code:'YYZ', city:'Toronto',       country:'Canada',      lat:43.6777,  lon:-79.6248  },
      { code:'MEX', city:'Mexico City',   country:'Mexico',      lat:19.4361,  lon:-99.0719  },
      { code:'ATL', city:'Atlanta',       country:'USA',         lat:33.6407,  lon:-84.4277  },
      { code:'SEA', city:'Seattle',       country:'USA',         lat:47.4502,  lon:-122.3088 },
      { code:'DFW', city:'Dallas',        country:'USA',         lat:32.8998,  lon:-97.0403  },
      // Europe
      { code:'LHR', city:'London',        country:'UK',          lat:51.4700,  lon:-0.4543   },
      { code:'CDG', city:'Paris',         country:'France',      lat:49.0097,  lon:2.5479    },
      { code:'FRA', city:'Frankfurt',     country:'Germany',     lat:50.0379,  lon:8.5622    },
      { code:'AMS', city:'Amsterdam',     country:'Netherlands', lat:52.3086,  lon:4.7639    },
      { code:'MAD', city:'Madrid',        country:'Spain',       lat:40.4719,  lon:-3.5626   },
      { code:'FCO', city:'Rome',          country:'Italy',       lat:41.8003,  lon:12.2389   },
      { code:'IST', city:'Istanbul',      country:'Turkey',      lat:41.2753,  lon:28.7519   },
      { code:'MUC', city:'Munich',        country:'Germany',     lat:48.3538,  lon:11.7861   },
      { code:'ZRH', city:'Zurich',        country:'Switzerland', lat:47.4647,  lon:8.5492    },
      { code:'CPH', city:'Copenhagen',    country:'Denmark',     lat:55.6180,  lon:12.6508   },
      // Asia
      { code:'HND', city:'Tokyo',         country:'Japan',       lat:35.5494,  lon:139.7798  },
      { code:'PEK', city:'Beijing',       country:'China',       lat:40.0801,  lon:116.5846  },
      { code:'PVG', city:'Shanghai',      country:'China',       lat:31.1443,  lon:121.8083  },
      { code:'HKG', city:'Hong Kong',     country:'China',       lat:22.3080,  lon:113.9185  },
      { code:'SIN', city:'Singapore',     country:'Singapore',   lat:1.3644,   lon:103.9915  },
      { code:'BKK', city:'Bangkok',       country:'Thailand',    lat:13.6900,  lon:100.7501  },
      { code:'ICN', city:'Seoul',         country:'S.Korea',     lat:37.4691,  lon:126.4510  },
      { code:'DEL', city:'Delhi',         country:'India',       lat:28.5665,  lon:77.1031   },
      { code:'BOM', city:'Mumbai',        country:'India',       lat:19.0896,  lon:72.8656   },
      { code:'KUL', city:'Kuala Lumpur',  country:'Malaysia',    lat:2.7456,   lon:101.7099  },
      // Middle East & Africa
      { code:'DXB', city:'Dubai',         country:'UAE',         lat:25.2532,  lon:55.3657   },
      { code:'DOH', city:'Doha',          country:'Qatar',       lat:25.2731,  lon:51.6080   },
      { code:'CAI', city:'Cairo',         country:'Egypt',       lat:30.1219,  lon:31.4056   },
      { code:'JNB', city:'Johannesburg',  country:'S.Africa',    lat:-26.1392, lon:28.2460   },
      { code:'NBO', city:'Nairobi',       country:'Kenya',       lat:-1.3192,  lon:36.9275   },
      // South America
      { code:'GRU', city:'São Paulo',     country:'Brazil',      lat:-23.4356, lon:-46.4731  },
      { code:'EZE', city:'Buenos Aires',  country:'Argentina',   lat:-34.8222, lon:-58.5358  },
      { code:'BOG', city:'Bogotá',        country:'Colombia',    lat:4.7016,   lon:-74.1469  },
      { code:'LIM', city:'Lima',          country:'Peru',        lat:-12.0219, lon:-77.1143  },
      // Oceania
      { code:'SYD', city:'Sydney',        country:'Australia',   lat:-33.9461, lon:151.1772  },
      { code:'MEL', city:'Melbourne',     country:'Australia',   lat:-37.6690, lon:144.8410  },
      { code:'AKL', city:'Auckland',      country:'N.Zealand',   lat:-37.0082, lon:174.7850  },
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

    // ── Generate 80 globally spread flights ───────────────────────────────────
    this.flights = [];
    for (let i = 0; i < 80; i++) {
      const orig = AIRPORTS[i % AIRPORTS.length];
      let dIdx   = (i * 7 + 13) % AIRPORTS.length;
      if (dIdx === i % AIRPORTS.length) dIdx = (dIdx + 1) % AIRPORTS.length;
      const dest = AIRPORTS[dIdx];
      const al   = AIRLINES[i % AIRLINES.length];
      const pct  = (i * 11 + 3) % 90 + 5;       // 5–95% progress
      const t    = pct / 100;
      const lat  = orig.lat + (dest.lat - orig.lat) * t;
      const lon  = orig.lon + (dest.lon - orig.lon) * t;
      const hdg  = calculateHeading(lat, lon, dest.lat, dest.lon);
      this.flights.push({
        flightId:        al.cs + (100 + i),
        callsign:        al.cs + (100 + i),
        airline:         al.name,
        aircraftType:    TYPES[i % TYPES.length],
        registration:    al.cs.charAt(0) + '-' + Math.floor(Math.random()*9000+1000),
        countryFlag:     al.flag,
        photoUrl:        'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&auto=format&fit=crop&q=80',
        origin:          { code:orig.code, city:orig.city, country:orig.country, lat:orig.lat, lon:orig.lon },
        destination:     { code:dest.code, city:dest.city, country:dest.country, lat:dest.lat, lon:dest.lon },
        std:'--:-- UTC', atd:'--:-- UTC', sta:'--:-- UTC', eta:'--:-- UTC',
        radarSource:     'SIM-ADS-B-' + orig.code,
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

    this.emit('telemetry_batch', this.flights.map(f => f._event));
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
}

module.exports = new ADSBTelemetrySimulator();
