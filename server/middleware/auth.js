const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'aws_flight_telemetry_secret_key_2026';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For demo convenience, attach default demo analyst user if token missing
    req.user = { id: 'demo_user', username: 'demo_analyst', role: 'Admin' };
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired JWT token' });
  }
};

const checkRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' lacks permission for this resource.`
      });
    }
    next();
  };
};

module.exports = { verifyToken, checkRole, JWT_SECRET };
