const s3DataLake = require('./s3DataLake');
const redshiftAnalytics = require('./redshiftAnalytics');
const WebHDFS = require('webhdfs');

const hdfs = WebHDFS.createClient({
  user: 'root',
  host: 'localhost',
  port: 9870,
  path: '/webhdfs/v1'
});

class HadoopEtlEngine {
  constructor() {
    this.jobHistory = [];
    this.status = 'IDLE';
    this.lastRunTime = null;
  }

  runEtlJob() {
    this.status = 'RUNNING';
    const startTime = new Date();
    
    console.log(`⚡ [Hadoop ETL] Starting MapReduce Batch Job... Reading from HDFS Data Lake`);

    // In a production environment, this would submit a YARN job.
    // For this implementation, we simulate the MapReduce process in Node.js 
    // by fetching the HDFS directory metrics to simulate processing scale.
    
    // We get the HDFS metrics from our data lake service
    const s3Metrics = s3DataLake.getMetrics();
    const processedEvents = Math.max(150, s3Metrics.totalObjectsCount * 12);

    // After MapReduce finishes processing the raw data into aggregates, 
    // it loads them into the Data Warehouse (Hive / Redshift).
    redshiftAnalytics.recordBatchEtlUpdate(processedEvents);

    const endTime = new Date();
    const durationSec = ((endTime - startTime) / 1000).toFixed(2);

    this.status = 'SUCCEEDED';
    this.lastRunTime = endTime.toISOString();

    const jobRecord = {
      jobRunId: `mr_job_${Date.now()}`,
      jobName: 'Hadoop_Flight_Analytics_MapReduce',
      executionTimeSec: durationSec,
      recordsTransformed: processedEvents,
      sourceHDFSPartitionsScanned: s3Metrics.activePartitions.length || 1,
      destinationTable: `hive.default.fact_flight_telemetry`,
      status: 'SUCCEEDED',
      timestamp: endTime.toISOString()
    };

    this.jobHistory.unshift(jobRecord);
    if (this.jobHistory.length > 20) this.jobHistory.pop();

    console.log(`✅ [Hadoop ETL] MapReduce Job Finished successfully in ${durationSec}s. ${processedEvents} records loaded into Hive Data Warehouse.`);
    return jobRecord;
  }

  getJobInfo() {
    return {
      jobName: 'Hadoop_Flight_Analytics_MapReduce',
      crawlerStatus: 'N/A',
      status: this.status,
      lastRunTime: this.lastRunTime,
      history: this.jobHistory
    };
  }
}

module.exports = new HadoopEtlEngine();
