const fs = require('fs');
const path = require('path');
const awsConfig = require('../config/awsConfig');

const s3StorageDir = path.join(__dirname, '../data/s3_datalake');

if (!fs.existsSync(s3StorageDir)) {
  fs.mkdirSync(s3StorageDir, { recursive: true });
}

class S3DataLakeService {
  constructor() {
    this.totalObjectsCount = 0;
    this.totalSizeBytes = 0;
    this.bucketName = awsConfig.s3.bucketName;
    this.recentPartitions = new Set();
  }

  writeTelemetryBatch(events) {
    if (!events || events.length === 0) return;

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');

    const partitionPath = `year=${year}/month=${month}/day=${day}/hour=${hour}`;
    const fullDirPath = path.join(s3StorageDir, partitionPath);

    if (!fs.existsSync(fullDirPath)) {
      fs.mkdirSync(fullDirPath, { recursive: true });
    }

    const filename = `adsb_batch_${Date.now()}.json`;
    const filepath = path.join(fullDirPath, filename);

    const payload = JSON.stringify({
      bucket: this.bucketName,
      partitionKey: partitionPath,
      eventCount: events.length,
      timestamp: now.toISOString(),
      schemaVersion: '1.0-parquet-compat',
      events: events
    }, null, 2);

    fs.writeFileSync(filepath, payload, 'utf8');

    this.totalObjectsCount += 1;
    this.totalSizeBytes += payload.length;
    this.recentPartitions.add(partitionPath);
  }

  getMetrics() {
    return {
      bucketName: this.bucketName,
      totalObjectsCount: this.totalObjectsCount,
      totalSizeBytes: this.totalSizeBytes,
      totalSizeMB: (this.totalSizeBytes / (1024 * 1024)).toFixed(2),
      activePartitions: Array.from(this.recentPartitions),
      storageClass: awsConfig.s3.storageClass,
      status: 'ONLINE'
    };
  }
}

module.exports = new S3DataLakeService();
