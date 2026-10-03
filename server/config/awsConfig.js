module.exports = {
  region: process.env.AWS_REGION || 'us-east-1',
  msk: {
    clusterName: 'flight-telemetry-msk-cluster',
    topic: 'raw-adsb-telemetry-feed',
    partitions: 6,
    replicationFactor: 3,
    status: 'ACTIVE'
  },
  kinesis: {
    streamName: 'telemetry-realtime-analytics-stream',
    shards: 4,
    status: 'ACTIVE'
  },
  documentDb: {
    clusterIdentifier: 'flight-docdb-cluster',
    database: 'flight_telemetry_ops',
    collections: ['flights', 'alerts', 'users', 'airspace_config'],
    status: 'AVAILABLE'
  },
  s3: {
    bucketName: 'aws-flight-telemetry-datalake-prod',
    prefix: 'telemetry-raw/year=',
    storageClass: 'INTELLIGENT_TIERING',
    kmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/flight-datalake'
  },
  glue: {
    jobName: 'flight-adsb-etl-batch-transform',
    databaseName: 'flight_telemetry_catalog',
    tableName: 'raw_adsb_partitioned',
    crawlerStatus: 'READY'
  },
  redshift: {
    clusterIdentifier: 'flight-analytics-redshift-dw',
    database: 'aviation_bi_dw',
    schema: 'public',
    nodeType: 'ra3.xlplus',
    nodes: 2,
    status: 'AVAILABLE'
  },
  quicksight: {
    dashboardId: 'flight-operational-telemetry-qs-dash',
    dashboardName: 'Real-time & Historical Flight Telemetry Analytics',
    refreshRateMinutes: 5
  }
};
