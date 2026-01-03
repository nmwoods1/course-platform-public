// Windows-only: uninstall the background service.
// Run: npm run uninstall-service

const path = require('path');

// eslint-disable-next-line import/no-extraneous-dependencies
const Service = require('node-windows').Service;

const script = path.join(__dirname, '..', 'src', 'server.js');

const svc = new Service({
  name: 'Personal Learning Companion',
  script
});

svc.on('uninstall', () => {
  // eslint-disable-next-line no-console
  console.log('Service uninstalled.');
});

svc.on('alreadyuninstalled', () => {
  // eslint-disable-next-line no-console
  console.log('Service is not installed.');
});

svc.uninstall();

