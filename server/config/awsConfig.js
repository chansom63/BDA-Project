module.exports = {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  
  msk: {
    clusterName: process.env.AWS_MSK_CLUSTER_NAME || 'flight-telemetry-msk-cluster',
    brokers: process.env.AWS_MSK_BROKERS || 'b-1.flight-msk.abc123.c2.kafka.us-east-1.amazonaws.com:9092',
    topic: process.env.AWS_MSK_TOPIC || 'raw-adsb-telemetry-feed',
    partitions: Number(process.env.AWS_MSK_PARTITIONS) || 6,
    replicationFactor: 3,
    status: 'ACTIVE'
  },
  kinesis: {
    streamName: process.env.AWS_KINESIS_STREAM_NAME || 'telemetry-realtime-analytics-stream',
    shards: Number(process.env.AWS_KINESIS_SHARDS) || 4,
    status: 'ACTIVE'
  },
  documentDb: {
    clusterIdentifier: process.env.AWS_DOCUMENTDB_CLUSTER_ID || 'flight-docdb-cluster',
    database: process.env.AWS_DOCUMENTDB_DATABASE || 'flight_telemetry_ops',
    collections: ['flights', 'alerts', 'users', 'airspace_config'],
    status: 'AVAILABLE'
  },
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME || 'aws-flight-telemetry-datalake-prod',
    prefix: process.env.AWS_S3_PREFIX || 'telemetry-raw/year=',
    storageClass: process.env.AWS_S3_STORAGE_CLASS || 'INTELLIGENT_TIERING',
    kmsKeyId: process.env.AWS_S3_KMS_KEY_ID || 'arn:aws:kms:us-east-1:123456789012:key/flight-datalake'
  },
  glue: {
    jobName: process.env.AWS_GLUE_JOB_NAME || 'flight-adsb-etl-batch-transform',
    databaseName: process.env.AWS_GLUE_DATABASE_NAME || 'flight_telemetry_catalog',
    tableName: 'raw_adsb_partitioned',
    crawlerStatus: 'READY'
  },
  redshift: {
    clusterIdentifier: process.env.AWS_REDSHIFT_CLUSTER_ID || 'flight-analytics-redshift-dw',
    database: process.env.AWS_REDSHIFT_DATABASE || 'aviation_bi_dw',
    schema: 'public',
    nodeType: 'ra3.xlplus',
    nodes: 2,
    status: 'AVAILABLE'
  },
  quicksight: {
    dashboardId: process.env.AWS_QUICKSIGHT_DASHBOARD_ID || 'flight-operational-telemetry-qs-dash',
    dashboardName: 'Real-time & Historical Flight Telemetry Analytics',
    refreshRateMinutes: 5
  },
  notifications: {
    sesSenderEmail: process.env.AWS_SES_SENDER_EMAIL || 'emergency-dispatch@aviation.aws',
    snsDefaultPhone: process.env.AWS_SNS_DEFAULT_PHONE || '+1 (800) 555-0199'
  },
  externalKeys: {
    mapboxToken: process.env.MAPBOX_ACCESS_TOKEN || '',
    openWeatherApiKey: process.env.OPENWEATHER_API_KEY || ''
  }
};
