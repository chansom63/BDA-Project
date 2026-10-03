const s3DataLake = require('./s3DataLake');
const redshiftAnalytics = require('./redshiftAnalytics');
const awsConfig = require('../config/awsConfig');

class GlueEtlEngine {
  constructor() {
    this.jobHistory = [];
    this.status = 'IDLE';
    this.lastRunTime = null;
  }

  runEtlJob() {
    this.status = 'RUNNING';
    const startTime = new Date();
    
    console.log(`⚡ [AWS Glue ETL] Starting Job "${awsConfig.glue.jobName}"... Crawling S3 data lake bucket "${awsConfig.s3.bucketName}"`);

    const s3Metrics = s3DataLake.getMetrics();
    const processedEvents = Math.max(150, s3Metrics.totalObjectsCount * 12);

    // Update Redshift analytical tables
    redshiftAnalytics.recordBatchEtlUpdate(processedEvents);

    const endTime = new Date();
    const durationSec = ((endTime - startTime) / 1000).toFixed(2);

    this.status = 'SUCCEEDED';
    this.lastRunTime = endTime.toISOString();

    const jobRecord = {
      jobRunId: `jr_${Date.now()}`,
      jobName: awsConfig.glue.jobName,
      executionTimeSec: durationSec,
      recordsTransformed: processedEvents,
      sourceS3PartitionsScanned: s3Metrics.activePartitions.length || 1,
      destinationRedshiftTable: `${awsConfig.redshift.database}.public.fact_flight_telemetry`,
      status: 'SUCCEEDED',
      timestamp: endTime.toISOString()
    };

    this.jobHistory.unshift(jobRecord);
    if (this.jobHistory.length > 20) this.jobHistory.pop();

    console.log(`✅ [AWS Glue ETL] Job Finished successfully in ${durationSec}s. ${processedEvents} records loaded into Amazon Redshift.`);
    return jobRecord;
  }

  getJobInfo() {
    return {
      jobName: awsConfig.glue.jobName,
      crawlerStatus: awsConfig.glue.crawlerStatus,
      status: this.status,
      lastRunTime: this.lastRunTime,
      history: this.jobHistory
    };
  }
}

module.exports = new GlueEtlEngine();
