// Windows-only: install this server as a background service.
// Run: npm run install-service

const path = require('path');

// eslint-disable-next-line import/no-extraneous-dependencies
const Service = require('node-windows').Service;

const script = path.join(__dirname, '..', 'src', 'server.js');

const svc = new Service({
  name: 'Personal Learning Companion',
  description: 'Local-first learning companion server (Express + SQLite)',
  script,
  nodeOptions: ['--max_old_space_size=4096']
});

svc.on('install', () => {
  svc.start();
  // eslint-disable-next-line no-console
  console.log('Service installed and started.');
});

svc.on('alreadyinstalled', () => {
  // eslint-disable-next-line no-console
  console.log('Service is already installed.');
});

svc.install();

