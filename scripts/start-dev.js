const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Launching Monolithic MERN AWS Flight Telemetry System...');

const rootDir = path.resolve(__dirname, '..');

const server = spawn('npm', ['run', 'dev'], {
  cwd: path.join(rootDir, 'server'),
  stdio: 'inherit',
  shell: true
});

const client = spawn('npm', ['run', 'dev'], {
  cwd: path.join(rootDir, 'client'),
  stdio: 'inherit',
  shell: true
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
  client.kill('SIGINT');
  process.exit();
});
