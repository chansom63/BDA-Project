const Flight = require('../models/Flight');
const Alert = require('../models/Alert');
const AirspaceConfig = require('../models/AirspaceConfig');
const openSkyService = require('./openSkyService');
const adsbSimulator = require('./adsbSimulator');
const s3DataLake = require('./s3DataLake');
const notificationService = require('./notificationService');

// Haversine distance formula in Nautical Miles
function haversineNM(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class StreamProcessorService {
  constructor() {
    this.wss = null;
    this.activeAlertsMemory = new Map();
  }

  init(wss) {
    this.wss = wss;

    // Produce OpenSky data to Kafka (to mimic the friend's architecture)
    const kafkaService = require('./kafkaService');
    const clickhouseService = require('./clickhouseService');

    openSkyService.on('telemetry_batch', async (batch) => {
      kafkaService.produceTelemetryBatch(batch).catch(console.error);
    });

    // Consume from REAL Kafka stream
    kafkaService.consumeTelemetryStream(async (batch) => {
      await this.processTelemetryBatch(batch);
      await clickhouseService.insertBatch(batch);
    }).catch(console.error);


    console.log('⚡ Amazon Kinesis Stream Processor initialized & listening to OpenSky real-time ADS-B feed');
  }

  async processTelemetryBatch(batch) {
    if (!batch || batch.length === 0) return;

    // 1. Forward raw batch to S3 Data Lake (simulating AWS S3 raw ingestion)
    s3DataLake.writeTelemetryBatch(batch);

    // 2. Fetch airspace configuration thresholds
    let config = await AirspaceConfig.findOneAndUpdate(
      { configId: 'default_config' },
      { $setOnInsert: { configId: 'default_config' } },
      { upsert: true, new: true }
    );
    const proximityLimitNM = config.proximityAlertDistanceNM || 10.0;

    const updatedFlights = [];

    // 3. Upsert telemetry into MongoDB / DocumentDB
    for (const evt of batch) {
      try {
        const flightDoc = await Flight.findOneAndUpdate(
          { flightId: evt.flightId },
          {
            $set: {
              icao24: evt.icao24,
              callsign: evt.callsign,
              airline: evt.airline,
              aircraftType: evt.aircraftType,
              registration: evt.registration,
              photoUrl: evt.photoUrl,
              std: evt.std,
              atd: evt.atd,
              sta: evt.sta,
              eta: evt.eta,
              origin: evt.origin,
              destination: evt.destination,
              'currentPosition.lat': evt.latitude,
              'currentPosition.lon': evt.longitude,
              'currentPosition.altitudeFt': evt.altitudeFt,
              'currentPosition.speedKnots': evt.speedKnots,
              'currentPosition.headingDeg': evt.headingDeg,
              'currentPosition.verticalRateFpm': evt.verticalRateFpm,
              squawk: evt.squawk,
              status: evt.status,
              progressPct: evt.progressPct,
              weatherTurbulence: evt.weatherTurbulence,
              trajectory: evt.trajectory,
              lastTelemetryUpdate: new Date()
            }
          },
          { upsert: true, new: true }
        );
        updatedFlights.push(flightDoc);

        // Check Emergency Squawk Rules (7700, 7600, 7500)
        if (['7700', '7600', '7500'].includes(evt.squawk)) {
          const existingAlert = await Alert.findOne({
            flightId: evt.flightId,
            squawkCode: evt.squawk,
            status: 'Active'
          });

          if (!existingAlert) {
            const emergencyLabels = {
              '7700': 'GENERAL EMERGENCY DECLARATION',
              '7600': 'RADIO COMMUNICATIONS FAILURE',
              '7500': 'UNLAWFUL INTERFERENCE / HIJACK WARNING'
            };
            const msg = `EMERGENCY SQUAWK ${evt.squawk}: Flight ${evt.callsign} (${evt.airline}) declared ${emergencyLabels[evt.squawk]} at FL${Math.round(evt.altitudeFt/100)}`;
            
            const newAlert = await Alert.create({
              alertId: `alt_${Date.now()}_${Math.floor(Math.random()*1000)}`,
              type: 'EmergencySquawk',
              severity: 'EMERGENCY',
              flightId: evt.flightId,
              callsign: evt.callsign,
              squawkCode: evt.squawk,
              message: msg,
              location: { lat: evt.latitude, lon: evt.longitude, altitudeFt: evt.altitudeFt }
            });

            // Send SES Email & SNS SMS Notification
            if (config.autoNotificationEmail) {
              notificationService.sendEmailNotification(
                'emergency-dispatch@aviation.aws',
                `[CRITICAL ALERT] ${evt.callsign} Squawk ${evt.squawk}`,
                msg,
                newAlert.alertId
              );
            }
            if (config.autoNotificationSMS) {
              notificationService.sendSMSNotification(
                '+1 (800) 555-0199',
                `[MAYDAY] ${evt.callsign} Squawk ${evt.squawk} at Lat:${evt.latitude.toFixed(2)}, Lon:${evt.longitude.toFixed(2)}`,
                newAlert.alertId
              );
            }

            // Broadcast websocket alert
            this.broadcastWS({ type: 'NEW_ALERT', alert: newAlert });
          }
        }

      } catch (err) {
        console.error('Error updating flight stream item:', err.message);
      }
    }

    // Proximity alert generation disabled as per user specification (only emergency squawks are tracked)

    // 5. Delete stale flights (not seen in last 2 minutes) to keep MongoDB clean
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    await Flight.deleteMany({ lastTelemetryUpdate: { $lt: twoMinutesAgo } });

    // 6. Broadcast real-time telemetry frame to WebSockets
    this.broadcastWS({
      type: 'TELEMETRY_UPDATE',
      timestamp: new Date().toISOString(),
      flightsCount: updatedFlights.length,
      flights: updatedFlights
    });
  }

  broadcastWS(messageObj) {
    if (!this.wss) return;
    const jsonMsg = JSON.stringify(messageObj);
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(jsonMsg);
      }
    });
  }
}

module.exports = new StreamProcessorService();
