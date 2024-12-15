const express = require('express');
const { JWT_SECRET } = require('../config/envs');

const server = express();

require('./routes/index')(server);

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET isnot been defined in env.');
  process.exit(1);
}

module.exports = server;
