const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');

// Seed default accounts if empty
async function seedDefaultUsers() {
  const count = await User.countDocuments();
  if (count === 0) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    await User.create([
      {
        username: 'admin',
        email: 'admin@flightops.aws',
        password: hashedPassword,
        role: 'Admin',
        department: 'AWS Aviation Systems Command'
      },
      {
        username: 'analyst',
        email: 'analyst@flightops.aws',
        password: hashedPassword,
        role: 'Analyst',
        department: 'Telemetry Analytics & BI'
      },
      {
        username: 'dispatcher',
        email: 'dispatcher@flightops.aws',
        password: hashedPassword,
        role: 'Dispatcher',
        department: 'Air Traffic Control Dispatch'
      }
    ]);
    console.log('👤 Default RBAC accounts seeded (admin, analyst, dispatcher / pass: admin123)');
  }
}
seedDefaultUsers().catch(err => console.error('⚠️  User seeding error (non-fatal):', err.message));

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      $or: [{ username: username }, { email: username }]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        avatarUrl: user.avatarUrl,
        preferences: user.preferences
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      // Fallback for demo mode
      return res.json({
        success: true,
        user: {
          username: req.user.username || 'admin',
          email: 'admin@flightops.aws',
          role: req.user.role || 'Admin',
          department: 'Flight Telemetry Operations'
        }
      });
    }
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/users (Admin only)
router.get('/users', verifyToken, async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
