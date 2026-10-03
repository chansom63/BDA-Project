const express = require('express');
const router = express.Router();
const glueEtlEngine = require('../services/glueEtlEngine');
const s3DataLake = require('../services/s3DataLake');
const { verifyToken } = require('../middleware/auth');

// GET /api/etl/status - Fetch Glue ETL & S3 Data Lake catalog status
router.get('/status', async (req, res, next) => {
  try {
    const glueInfo = glueEtlEngine.getJobInfo();
    const s3Metrics = s3DataLake.getMetrics();
    res.json({
      success: true,
      glue: glueInfo,
      s3: s3Metrics
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/etl/run - Trigger AWS Glue ETL Batch Job
router.post('/run', verifyToken, async (req, res, next) => {
  try {
    const jobResult = glueEtlEngine.runEtlJob();
    res.json({
      success: true,
      message: 'AWS Glue ETL batch job executed successfully',
      jobResult
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
