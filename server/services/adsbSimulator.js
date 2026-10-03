const EventEmitter = require('events');

// Calculate distance in nautical miles (NM)
function haversineNM(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Radius of earth in Nautical Miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate initial heading in degrees (0-360)
function calculateHeading(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

class ADSBTelemetrySimulator extends EventEmitter {
  constructor() {
    super();
    this.intervalId = null;
    this.speedMultiplier = 1.0;
    this.isRunning = false;

    // Major global hub airports
    this.airports = [
      { code: 'JFK', icao: 'KJFK', name: 'John F. Kennedy Intl Airport', city: 'New York', country: 'United States', flag: '🇺🇸', lat: 40.6413, lon: -73.7781 },
      { code: 'LHR', icao: 'EGLL', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom', flag: '🇬🇧', lat: 51.4700, lon: -0.4543 },
      { code: 'LAX', icao: 'KLAX', name: 'Los Angeles Intl Airport', city: 'Los Angeles', country: 'United States', flag: '🇺🇸', lat: 33.9416, lon: -118.4085 },
      { code: 'SFO', icao: 'KSFO', name: 'San Francisco Intl Airport', city: 'San Francisco', country: 'United States', flag: '🇺🇸', lat: 37.6213, lon: -122.3790 },
      { code: 'HND', icao: 'RJTT', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan', flag: '🇯🇵', lat: 35.5494, lon: 139.7798 },
      { code: 'DXB', icao: 'OMDB', name: 'Dubai Intl Airport', city: 'Dubai', country: 'UAE', flag: '🇦🇪', lat: 25.2532, lon: 55.3657 },
      { code: 'FRA', icao: 'EDDF', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', flag: '🇩🇪', lat: 50.0379, lon: 8.5622 },
      { code: 'CDG', icao: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris', country: 'France', flag: '🇫🇷', lat: 49.0097, lon: 2.5479 },
      { code: 'SIN', icao: 'WSSS', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', flag: '🇸🇬', lat: 1.3644, lon: 103.9915 },
      { code: 'SYD', icao: 'YSSY', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', flag: '🇦🇺', lat: -33.9461, lon: 151.1772 },
      { code: 'ORD', icao: 'KORD', name: 'Chicago O\'Hare Intl Airport', city: 'Chicago', country: 'United States', flag: '🇺🇸', lat: 41.9742, lon: -87.9073 },
      { code: 'MIA', icao: 'KMIA', name: 'Miami Intl Airport', city: 'Miami', country: 'United States', flag: '🇺🇸', lat: 25.7959, lon: -80.2870 }
    ];

    // Flightradar24 realistic fleet dataset
    this.flights = [
      {
        flightId: 'AA104',
        callsign: 'AAL104',
        airline: 'American Airlines',
        aircraftType: 'Boeing 787-9 Dreamliner',
        registration: 'N800AN',
        countryFlag: '🇺🇸',
        photoUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'JFK', icao: 'KJFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        destination: { code: 'LHR', icao: 'EGLL', city: 'London', country: 'UK', lat: 51.4700, lon: -0.4543 },
        std: '19:30 UTC', atd: '19:42 UTC', sta: '07:30 UTC', eta: '07:18 UTC',
        radarSource: 'F-KJFK1', icao24: 'A04B11',
        lat: 46.200, lon: -41.500, altitudeFt: 37000, speedKnots: 495, headingDeg: 62, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 48, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'BA283',
        callsign: 'BAW283',
        airline: 'British Airways',
        aircraftType: 'Airbus A350-1000',
        registration: 'G-XWBA',
        countryFlag: '🇬🇧',
        photoUrl: 'https://images.unsplash.com/photo-1524592714635-d77511a4834d?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'LHR', icao: 'EGLL', city: 'London', country: 'UK', lat: 51.4700, lon: -0.4543 },
        destination: { code: 'LAX', icao: 'KLAX', city: 'Los Angeles', country: 'USA', lat: 33.9416, lon: -118.4085 },
        std: '11:15 UTC', atd: '11:28 UTC', sta: '20:10 UTC', eta: '19:55 UTC',
        radarSource: 'T-EGLL4', icao24: '400A0C',
        lat: 56.400, lon: -35.200, altitudeFt: 38000, speedKnots: 475, headingDeg: 280, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 35, weatherTurbulence: 'Light', trajectory: []
      },
      {
        flightId: 'DL402',
        callsign: 'DAL402',
        airline: 'Delta Air Lines',
        aircraftType: 'Airbus A330-900neo',
        registration: 'N401DN',
        countryFlag: '🇺🇸',
        photoUrl: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'LAX', icao: 'KLAX', city: 'Los Angeles', country: 'USA', lat: 33.9416, lon: -118.4085 },
        destination: { code: 'JFK', icao: 'KJFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        std: '14:00 UTC', atd: '14:05 UTC', sta: '22:15 UTC', eta: '22:02 UTC',
        radarSource: 'F-KLAX2', icao24: 'A12F98',
        lat: 38.200, lon: -95.400, altitudeFt: 35000, speedKnots: 510, headingDeg: 78, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 62, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'UA857',
        callsign: 'UAL857',
        airline: 'United Airlines',
        aircraftType: 'Boeing 777-300ER',
        registration: 'N2747U',
        countryFlag: '🇺🇸',
        photoUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'SFO', icao: 'KSFO', city: 'San Francisco', country: 'USA', lat: 37.6213, lon: -122.3790 },
        destination: { code: 'HND', icao: 'RJTT', city: 'Tokyo', country: 'Japan', lat: 35.5494, lon: 139.7798 },
        std: '12:30 UTC', atd: '12:44 UTC', sta: '02:40 UTC', eta: '02:25 UTC',
        radarSource: 'F-KSFO1', icao24: 'A98C44',
        lat: 48.500, lon: -160.200, altitudeFt: 34000, speedKnots: 460, headingDeg: 295, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 40, weatherTurbulence: 'Moderate', trajectory: []
      },
      {
        flightId: 'EK201',
        callsign: 'UAE201',
        airline: 'Emirates',
        aircraftType: 'Airbus A380-800 Superjumbo',
        registration: 'A6-EEO',
        countryFlag: '🇦🇪',
        photoUrl: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'DXB', icao: 'OMDB', city: 'Dubai', country: 'UAE', lat: 25.2532, lon: 55.3657 },
        destination: { code: 'JFK', icao: 'KJFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        std: '08:30 UTC', atd: '08:45 UTC', sta: '21:10 UTC', eta: '20:58 UTC',
        radarSource: 'F-OMDB3', icao24: '89601A',
        lat: 53.100, lon: 10.400, altitudeFt: 39000, speedKnots: 480, headingDeg: 290, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 52, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'LH400',
        callsign: 'DLH400',
        airline: 'Lufthansa',
        aircraftType: 'Boeing 747-8i Queen of the Skies',
        registration: 'D-ABYA',
        countryFlag: '🇩🇪',
        photoUrl: 'https://images.unsplash.com/photo-1517400508447-f8dd518b86db?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'FRA', icao: 'EDDF', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622 },
        destination: { code: 'JFK', icao: 'KJFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        std: '10:50 UTC', atd: '11:02 UTC', sta: '19:40 UTC', eta: '19:28 UTC',
        radarSource: 'F-EDDF2', icao24: '3C658A',
        lat: 52.800, lon: -20.500, altitudeFt: 36000, speedKnots: 470, headingDeg: 265, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 58, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'AF011',
        callsign: 'AFR011',
        airline: 'Air France',
        aircraftType: 'Airbus A350-900',
        registration: 'F-HTYA',
        countryFlag: '🇫🇷',
        photoUrl: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'JFK', icao: 'KJFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        destination: { code: 'CDG', icao: 'LFPG', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479 },
        std: '21:45 UTC', atd: '21:55 UTC', sta: '10:30 UTC', eta: '10:15 UTC',
        radarSource: 'F-KJFK2', icao24: '394A88',
        lat: 44.800, lon: -43.100, altitudeFt: 37000, speedKnots: 495, headingDeg: 65, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 45, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'SQ025',
        callsign: 'SIA025',
        airline: 'Singapore Airlines',
        aircraftType: 'Airbus A350-900ULR',
        registration: '9V-SNA',
        countryFlag: '🇸🇬',
        photoUrl: 'https://images.unsplash.com/photo-1520637691918-49302e482329?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'FRA', icao: 'EDDF', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622 },
        destination: { code: 'SIN', icao: 'WSSS', city: 'Singapore', country: 'Singapore', lat: 1.3644, lon: 103.9915 },
        std: '11:30 UTC', atd: '11:45 UTC', sta: '05:50 UTC', eta: '05:35 UTC',
        radarSource: 'F-EDDF1', icao24: '76B124',
        lat: 32.500, lon: 58.200, altitudeFt: 40000, speedKnots: 485, headingDeg: 120, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 42, weatherTurbulence: 'Light', trajectory: []
      },
      {
        flightId: 'QF012',
        callsign: 'QFA012',
        airline: 'Qantas Airways',
        aircraftType: 'Boeing 787-9 Dreamliner',
        registration: 'VH-ZNA',
        countryFlag: '🇦🇺',
        photoUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'LAX', icao: 'KLAX', city: 'Los Angeles', country: 'USA', lat: 33.9416, lon: -118.4085 },
        destination: { code: 'SYD', icao: 'YSSY', city: 'Sydney', country: 'Australia', lat: -33.9461, lon: 151.1772 },
        std: '22:30 UTC', atd: '22:42 UTC', sta: '06:15 UTC', eta: '06:00 UTC',
        radarSource: 'F-KLAX1', icao24: '7C6B21',
        lat: -5.200, lon: -168.400, altitudeFt: 38000, speedKnots: 470, headingDeg: 225, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 55, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'CX888',
        callsign: 'CPA888',
        airline: 'Cathay Pacific',
        aircraftType: 'Airbus A350-1000',
        registration: 'B-LXR',
        countryFlag: '🇭🇰',
        photoUrl: 'https://images.unsplash.com/photo-1524592714635-d77511a4834d?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'HKG', icao: 'VHHH', city: 'Hong Kong', country: 'China', lat: 22.3080, lon: 113.9185 },
        destination: { code: 'JFK', icao: 'KJFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        std: '00:15 UTC', atd: '00:30 UTC', sta: '14:20 UTC', eta: '14:05 UTC',
        radarSource: 'F-VHHH1', icao24: '780F2A',
        lat: 58.400, lon: -140.200, altitudeFt: 36000, speedKnots: 490, headingDeg: 70, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 60, weatherTurbulence: 'None', trajectory: []
      },
      // Proximity Alert Pair
      {
        flightId: 'DL044',
        callsign: 'DAL044',
        airline: 'Delta Air Lines',
        aircraftType: 'Boeing 767-400ER',
        registration: 'N844MH',
        countryFlag: '🇺🇸',
        photoUrl: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'JFK', icao: 'KJFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        destination: { code: 'CDG', icao: 'LFPG', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479 },
        std: '19:40 UTC', atd: '19:50 UTC', sta: '08:10 UTC', eta: '08:00 UTC',
        radarSource: 'F-KJFK3', icao24: 'A045BB',
        lat: 46.220, lon: -41.480, altitudeFt: 37000, speedKnots: 488, headingDeg: 62, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 48, weatherTurbulence: 'Light', trajectory: []
      },
      // Emergency Aircraft 7700 MAYDAY
      {
        flightId: 'MAYDAY77',
        callsign: 'EMG7700',
        airline: 'Global Air Cargo',
        aircraftType: 'Boeing 747-400F Freighter',
        registration: 'N770EM',
        countryFlag: '🇺🇸',
        photoUrl: 'https://images.unsplash.com/photo-1517400508447-f8dd518b86db?w=600&auto=format&fit=crop&q=80',
        origin: { code: 'ORD', icao: 'KORD', city: 'Chicago', country: 'USA', lat: 41.9742, lon: -87.9073 },
        destination: { code: 'FRA', icao: 'EDDF', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622 },
        std: '15:00 UTC', atd: '15:12 UTC', sta: '03:15 UTC', eta: '03:45 UTC',
        radarSource: 'F-KORD1', icao24: 'A77000',
        lat: 51.200, lon: -30.500, altitudeFt: 24000, speedKnots: 380, headingDeg: 90, verticalRateFpm: -1800,
        squawk: '7700', status: 'Emergency', progressPct: 50, weatherTurbulence: 'Severe', trajectory: []
      }
    ];

    // Seed initial trajectories
    this.flights.forEach(f => {
      f.trajectory.push({
        lat: f.lat,
        lon: f.lon,
        altitudeFt: f.altitudeFt,
        speedKnots: f.speedKnots,
        timestamp: new Date()
      });
    });
  }

  startSimulation(intervalMs = 2000) {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this.tick();
    }, intervalMs);
    console.log('📡 ADS-B Telemetry Generator service STARTED (Simulated MSK Ingestion active)');
  }

  stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ ADS-B Telemetry Generator service STOPPED');
  }

  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = Math.max(0.1, Math.min(20, multiplier));
  }

  tick() {
    const timeDeltaHours = (2 / 3600) * this.speedMultiplier;

    const telemetryEvents = [];

    this.flights.forEach(f => {
      // Calculate target heading towards destination
      const targetHeading = calculateHeading(f.lat, f.lon, f.destination.lat, f.destination.lon);
      f.headingDeg = targetHeading;

      // Move latitude and longitude based on speed and heading
      const distanceMovedNM = f.speedKnots * timeDeltaHours;
      const dLat = (distanceMovedNM / 60.0) * Math.cos(f.headingDeg * Math.PI / 180);
      const dLon = (distanceMovedNM / 60.0) * Math.sin(f.headingDeg * Math.PI / 180) / Math.cos(f.lat * Math.PI / 180);

      f.lat += dLat;
      f.lon += dLon;

      // Handle vertical rate / altitude adjustment
      if (f.verticalRateFpm !== 0) {
        f.altitudeFt += (f.verticalRateFpm * (2 / 60) * this.speedMultiplier);
        if (f.altitudeFt <= 5000 && f.status === 'Emergency') {
          f.verticalRateFpm = 0; // level off for emergency landing
        }
      }

      // Calculate progress percentage
      const totalDistance = haversineNM(f.origin.lat, f.origin.lon, f.destination.lat, f.destination.lon);
      const remainingDistance = haversineNM(f.lat, f.lon, f.destination.lat, f.destination.lon);
      f.progressPct = Math.min(100, Math.max(0, Math.round(((totalDistance - remainingDistance) / totalDistance) * 100)));

      // If near destination (< 20 NM), reset route for continuous flight simulation
      if (remainingDistance < 20) {
        f.lat = f.origin.lat + 0.5;
        f.lon = f.origin.lon + 0.5;
        f.altitudeFt = 34000;
        f.status = 'In-Flight';
        f.progressPct = 0;
        f.trajectory = [];
      }

      // Append trajectory (max 40 points for smooth playback trails)
      if (f.trajectory.length > 40) f.trajectory.shift();
      f.trajectory.push({
        lat: f.lat,
        lon: f.lon,
        altitudeFt: f.altitudeFt,
        speedKnots: f.speedKnots,
        timestamp: new Date()
      });

      // Construct ADS-B telemetry payload
      const telemetryEvent = {
        eventId: `evt_${Date.now()}_${f.flightId}`,
        timestamp: new Date().toISOString(),
        icao24: f.icao24,
        callsign: f.callsign,
        flightId: f.flightId,
        airline: f.airline,
        aircraftType: f.aircraftType,
        registration: f.registration,
        countryFlag: f.countryFlag,
        photoUrl: f.photoUrl,
        std: f.std, atd: f.atd, sta: f.sta, eta: f.eta,
        radarSource: f.radarSource,
        origin: f.origin,
        destination: f.destination,
        latitude: f.lat,
        longitude: f.lon,
        altitudeFt: Math.round(f.altitudeFt),
        speedKnots: Math.round(f.speedKnots),
        headingDeg: Math.round(f.headingDeg),
        verticalRateFpm: Math.round(f.verticalRateFpm),
        squawk: f.squawk,
        status: f.status,
        progressPct: f.progressPct,
        weatherTurbulence: f.weatherTurbulence,
        trajectory: f.trajectory
      };

      telemetryEvents.push(telemetryEvent);
    });

    this.emit('telemetry_batch', telemetryEvents);
  }

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

const simulator = new ADSBTelemetrySimulator();
module.exports = simulator;
