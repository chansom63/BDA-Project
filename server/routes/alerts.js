const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const notificationService = require('../services/notificationService');
const { verifyToken } = require('../middleware/auth');

// GET /api/alerts - Fetch alerts with optional status or severity filter
router.get('/', async (req, res, next) => {
  try {
    const { status, severity } = req.query;
    const filter = {};
    if (status && status !== 'ALL') filter.status = status;
    if (severity && severity !== 'ALL') filter.severity = severity;

    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({
      success: true,
      count: alerts.length,
      alerts,
      notificationLogs: notificationService.getLogs()
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/:alertId/acknowledge - Acknowledge alert
router.post('/:alertId/acknowledge', verifyToken, async (req, res, next) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { alertId: req.params.alertId },
      {
        $set: {
          acknowledged: true,
          acknowledgedBy: req.user.username || 'System Operator',
          acknowledgedAt: new Date(),
          status: 'Resolved'
        }
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    res.json({ success: true, alert });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/clear-all - Acknowledge and clear all active alerts
router.post('/clear-all', async (req, res, next) => {
  try {
    await Alert.updateMany(
      { acknowledged: false },
      {
        $set: {
          acknowledged: true,
          acknowledgedBy: 'System Operator',
          acknowledgedAt: new Date(),
          status: 'Resolved'
        }
      }
    );
    res.json({ success: true, message: 'All active alerts cleared and marked as resolved' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
