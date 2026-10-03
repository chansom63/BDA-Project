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

    // Initial default international flight fleet across US, Europe, Asia, Atlantic, Pacific corridors
    this.flights = [
      {
        flightId: 'AA104',
        icao24: 'A04B11',
        callsign: 'AAL104',
        airline: 'American Airlines',
        aircraftType: 'Boeing 787-9',
        origin: { code: 'JFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        destination: { code: 'LHR', city: 'London', country: 'UK', lat: 51.4700, lon: -0.4543 },
        lat: 45.200, lon: -42.500, altitudeFt: 37000, speedKnots: 490, headingDeg: 62, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 48, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'BA283',
        icao24: '400A0C',
        callsign: 'BAW283',
        airline: 'British Airways',
        aircraftType: 'Airbus A350-1000',
        origin: { code: 'LHR', city: 'London', country: 'UK', lat: 51.4700, lon: -0.4543 },
        destination: { code: 'LAX', city: 'Los Angeles', country: 'USA', lat: 33.9416, lon: -118.4085 },
        lat: 56.400, lon: -35.200, altitudeFt: 38000, speedKnots: 475, headingDeg: 280, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 35, weatherTurbulence: 'Light', trajectory: []
      },
      {
        flightId: 'DL402',
        icao24: 'A12F98',
        callsign: 'DAL402',
        airline: 'Delta Air Lines',
        aircraftType: 'Airbus A330-900',
        origin: { code: 'LAX', city: 'Los Angeles', country: 'USA', lat: 33.9416, lon: -118.4085 },
        destination: { code: 'JFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        lat: 38.200, lon: -95.400, altitudeFt: 35000, speedKnots: 510, headingDeg: 78, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 62, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'UA857',
        icao24: 'A98C44',
        callsign: 'UAL857',
        airline: 'United Airlines',
        aircraftType: 'Boeing 777-300ER',
        origin: { code: 'SFO', city: 'San Francisco', country: 'USA', lat: 37.6213, lon: -122.3790 },
        destination: { code: 'HND', city: 'Tokyo', country: 'Japan', lat: 35.5494, lon: 139.7798 },
        lat: 48.500, lon: -160.200, altitudeFt: 34000, speedKnots: 460, headingDeg: 295, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 40, weatherTurbulence: 'Moderate', trajectory: []
      },
      {
        flightId: 'EK201',
        icao24: '89601A',
        callsign: 'UAE201',
        airline: 'Emirates',
        aircraftType: 'Airbus A380-800',
        origin: { code: 'DXB', city: 'Dubai', country: 'UAE', lat: 25.2532, lon: 55.3657 },
        destination: { code: 'JFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        lat: 53.100, lon: 10.400, altitudeFt: 39000, speedKnots: 480, headingDeg: 290, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 52, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'LH400',
        icao24: '3C658A',
        callsign: 'DLH400',
        airline: 'Lufthansa',
        aircraftType: 'Boeing 747-8i',
        origin: { code: 'FRA', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622 },
        destination: { code: 'JFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        lat: 52.800, lon: -20.500, altitudeFt: 36000, speedKnots: 470, headingDeg: 265, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 58, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'AF011',
        icao24: '394A88',
        callsign: 'AFR011',
        airline: 'Air France',
        aircraftType: 'Airbus A350-900',
        origin: { code: 'JFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        destination: { code: 'CDG', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479 },
        lat: 44.800, lon: -43.100, altitudeFt: 37000, speedKnots: 495, headingDeg: 65, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 45, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'SQ025',
        icao24: '76B124',
        callsign: 'SIA025',
        airline: 'Singapore Airlines',
        aircraftType: 'Airbus A350-900ULR',
        origin: { code: 'FRA', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622 },
        destination: { code: 'SIN', city: 'Singapore', country: 'Singapore', lat: 1.3644, lon: 103.9915 },
        lat: 32.500, lon: 58.200, altitudeFt: 40000, speedKnots: 485, headingDeg: 120, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 42, weatherTurbulence: 'Light', trajectory: []
      },
      {
        flightId: 'QF012',
        icao24: '7C6B21',
        callsign: 'QFA012',
        airline: 'Qantas Airways',
        aircraftType: 'Boeing 787-9',
        origin: { code: 'LAX', city: 'Los Angeles', country: 'USA', lat: 33.9416, lon: -118.4085 },
        destination: { code: 'SYD', city: 'Sydney', country: 'Australia', lat: -33.9461, lon: 151.1772 },
        lat: -5.200, lon: -168.400, altitudeFt: 38000, speedKnots: 470, headingDeg: 225, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 55, weatherTurbulence: 'None', trajectory: []
      },
      {
        flightId: 'CX888',
        icao24: '780F2A',
        callsign: 'CPA888',
        airline: 'Cathay Pacific',
        aircraftType: 'Airbus A350-1000',
        origin: { code: 'HKG', city: 'Hong Kong', country: 'China', lat: 22.3080, lon: 113.9185 },
        destination: { code: 'JFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        lat: 58.400, lon: -140.200, altitudeFt: 36000, speedKnots: 490, headingDeg: 70, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 60, weatherTurbulence: 'None', trajectory: []
      },
      // Proximity Alert Test Pair (Flying close near North Atlantic Track)
      {
        flightId: 'DL044',
        icao24: 'A045BB',
        callsign: 'DAL044',
        airline: 'Delta Air Lines',
        aircraftType: 'Boeing 767-400ER',
        origin: { code: 'JFK', city: 'New York', country: 'USA', lat: 40.6413, lon: -73.7781 },
        destination: { code: 'CDG', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479 },
        lat: 45.220, lon: -42.480, altitudeFt: 37000, speedKnots: 488, headingDeg: 62, verticalRateFpm: 0,
        squawk: '1200', status: 'In-Flight', progressPct: 48, weatherTurbulence: 'Light', trajectory: []
      },
      // Simulated Emergency Aircraft
      {
        flightId: 'MAYDAY77',
        icao24: 'A77000',
        callsign: 'EMG7700',
        airline: 'Global Air Cargo',
        aircraftType: 'Boeing 747-400F',
        origin: { code: 'ORD', city: 'Chicago', country: 'USA', lat: 41.9742, lon: -87.9073 },
        destination: { code: 'FRA', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622 },
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
    const timeDeltaHours = (2 / 3600) * this.speedMultiplier; // 2 seconds tick scaled

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

      // If near destination (< 20 NM), land & reset route
      if (remainingDistance < 20) {
        // Reset flight back near origin for continuous telemetry demonstration
        f.lat = f.origin.lat + 0.5;
        f.lon = f.origin.lon + 0.5;
        f.altitudeFt = 32000;
        f.status = 'In-Flight';
        f.progressPct = 0;
        f.trajectory = [];
      }

      // Append trajectory (max 30 points)
      if (f.trajectory.length > 30) f.trajectory.shift();
      f.trajectory.push({
        lat: f.lat,
        lon: f.lon,
        altitudeFt: f.altitudeFt,
        speedKnots: f.speedKnots,
        timestamp: new Date()
      });

      // Construct ADS-B telemetry raw event payload (simulating AWS MSK message)
      const telemetryEvent = {
        eventId: `evt_${Date.now()}_${f.flightId}`,
        timestamp: new Date().toISOString(),
        icao24: f.icao24,
        callsign: f.callsign,
        flightId: f.flightId,
        airline: f.airline,
        aircraftType: f.aircraftType,
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

    // Emit batch telemetry event to stream processor
    this.emit('telemetry_batch', telemetryEvents);
  }

  // Simulator manipulation functions (Trigger emergency, change squawk, add flight)
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
      origin: flightData.origin || { code: 'SFO', city: 'San Francisco', country: 'USA', lat: 37.6213, lon: -122.3790 },
      destination: flightData.destination || { code: 'ORD', city: 'Chicago', country: 'USA', lat: 41.9742, lon: -87.9073 },
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
