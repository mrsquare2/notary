// Single entry point, in the repository (backend/) and at the root of the deploy zip.
// Loads .env if present, then starts the API and the built web app on one port.
// No top-level await: some hosts (Hostinger's LiteSpeed lsnode, Passenger) load this file
// with require(), which fails on ES modules that use it.
import './src/env.js';

import('./src/server.js')
  .then(({ start }) => start())
  .catch((err) => {
    console.error('[notaryprep] failed to start:', err.message);
    process.exit(1);
  });
