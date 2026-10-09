const awsConfig = require('../config/awsConfig');
const http = require('http');

class HDFSDataLakeService {
  constructor() {
    this.totalObjectsCount = 0;
    this.totalSizeBytes = 0;
    this.bucketName = 'hdfs-data-lake';
    this.recentPartitions = new Set();
  }

  async writeTelemetryBatch(events) {
    if (!events || events.length === 0) return;

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');

    const partitionPath = `/data/telemetry/year=${year}/month=${month}/day=${day}/hour=${hour}`;
    const filename = `adsb_batch_${Date.now()}.json`;
    const filepath = `${partitionPath}/${filename}`;

    const payload = JSON.stringify({
      bucket: this.bucketName,
      partitionKey: partitionPath,
      eventCount: events.length,
      timestamp: now.toISOString(),
      schemaVersion: '1.0-hdfs-compat',
      events: events
    }, null, 2);

    try {
      // Create directory first
      await fetch(`http://127.0.0.1:9870/webhdfs/v1${partitionPath}?op=MKDIRS&user.name=root`, { method: 'PUT' }).catch(() => {});

      // Step 1: Request creation (expecting 307 redirect)
      const createUrl = `http://127.0.0.1:9870/webhdfs/v1${filepath}?op=CREATE&user.name=root&overwrite=true`;
      const res = await fetch(createUrl, { method: 'PUT', redirect: 'manual' });
      
      let location = res.headers.get('location');
      
      if (location) {
         // Step 2: Replace 'datanode' Docker hostname with '127.0.0.1' so Node.js can connect
         const redirectUrl = new URL(location);
         redirectUrl.hostname = '127.0.0.1';
         
         // Step 3: Upload the actual data using core http to bypass undici/fetch parsing bugs
         await new Promise((resolve, reject) => {
           const req = http.request(redirectUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': Buffer.byteLength(payload) } }, (uploadRes) => {
             if (uploadRes.statusCode >= 400) {
               reject(new Error(`Upload failed: ${uploadRes.statusCode}`));
             } else {
               resolve();
             }
           });
           req.on('error', reject);
           req.write(payload);
           req.end();
         });
      } else if (res.status >= 400) {
         throw new Error(`Failed to create file, status: ${res.status}`);
      }
      
      this.totalObjectsCount += 1;
      this.totalSizeBytes += payload.length;
      this.recentPartitions.add(partitionPath);
    } catch (err) {
       console.error('❌ HDFS Write Error:', err.message);
    }
  }

  getMetrics() {
    return {
      bucketName: this.bucketName,
      totalObjectsCount: this.totalObjectsCount,
      totalSizeBytes: this.totalSizeBytes,
      totalSizeMB: (this.totalSizeBytes / (1024 * 1024)).toFixed(2),
      activePartitions: Array.from(this.recentPartitions),
      storageClass: 'HDFS-STANDARD',
      status: 'ONLINE'
    };
  }
}

module.exports = new HDFSDataLakeService();
