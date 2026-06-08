#!/usr/bin/env node
'use strict';

const { main } = require('../cli/tealtiger-dashboard-cli');

main(process.argv.slice(2)).catch((error) => {
  const message = error && typeof error.message === 'string'
    ? error.message
    : String(error);
  console.error(message);
  process.exitCode = error && typeof error.exitCode === 'number' ? error.exitCode : 1;
});
