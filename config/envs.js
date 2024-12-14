/* eslint-disable max-len */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, './env/dev.env') });

module.exports = {
  PORT: process.env.PORT || 8100,
  QUEUE_PORT: process.env.QUEUE_PORT || 8010,
  NODE_ENV: process.env.NODE_ENV || 'development',

  MONGODB_CONNECTION_STRING: process.env.MONGODB_CONNECTION_STRING,

  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,

  QUEUE_CONCURRENCY: process.env.QUEUE_CONCURRENCY,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || 1800,

  SALT_ROUNDS: parseInt(process.env.SALT_ROUNDS, 10) || 10,

  RPC_URL: process.env.RPC_URL,
  WSS_RPC_URL: process.env.WSS_RPC_URL,
  RAYDIUM_AUTHORITY_V4: process.env.RAYDIUM_AUTHORITY_V4,
  RAYDIUM_POOL_V4_PROGRAM_ID: process.env.RAYDIUM_POOL_V4_PROGRAM_ID,
  SOL_MINT: process.env.SOL_MINT,
  SOL_DECIMALS: parseInt(process.env.SOL_DECIMALS, 10),
  BIRDEYE_BASE_URL: process.env.BIRDEYE_BASE_URL,
  BIRDEYE_API_KEY: process.env.BIRDEYE_API_KEY,
  RAYDIUM_AMM_AUTHORITY: process.env.RAYDIUM_AMM_AUTHORITY,
  TELEGRAM_STRING_SESSION: process.env.TELEGRAM_STRING_SESSION,
  TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH,
  TELEGRAM_API_ID: parseInt(process.env.TELEGRAM_API_ID, 10),
  PRIVATE_KEY: process.env.PRIVATE_KEY,
};
