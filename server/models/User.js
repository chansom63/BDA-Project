const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['Admin', 'Analyst', 'Dispatcher', 'Viewer'],
    default: 'Analyst'
  },
  department: { type: String, default: 'Flight Operations' },
  avatarUrl: { type: String, default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
  preferences: {
    theme: { type: String, default: 'dark' },
    notificationsEnabled: { type: Boolean, default: true },
    mapDefaultZoom: { type: Number, default: 4 },
    proximityAlertDistanceNM: { type: Number, default: 10 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
