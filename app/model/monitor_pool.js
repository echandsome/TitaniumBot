const mongoose = require('mongoose');

const { Schema } = mongoose;

const monitorPool = new Schema({

  poolId: {
    type: String,
    required: true,
    unique: true,
  },
  baseMint: {
    type: String,
    required: true,
  },
  quoteMint: {
    type: String,
    required: true,
  },
  lpMint: {
    type: String,
    required: true,
  },
  baseDecimals: {
    type: Number,
    required: true,
  },
  quoteDecimals: {
    type: Number,
    required: true,
  },
  lpDecimals: {
    type: Number,
    required: true,
  },
  version: {
    type: Number,
    required: true,
  },
  programId: {
    type: String,
    required: true,
  },
  authority: {
    type: String,
    required: true,
  },
  openOrders: {
    type: String,
    required: true,
  },
  targetOrders: {
    type: String,
    required: true,
  },
  baseVault: {
    type: String,
    required: true,
  },
  quoteVault: {
    type: String,
    required: true,
  },
  withdrawQueue: {
    type: String,
    required: true,
  },
  lpVault: {
    type: String,
    required: true,
  },
  marketVersion: {
    type: Number,
    required: true,
  },
  marketProgramId: {
    type: String,
    required: true,
  },
  marketId: {
    type: String,
    required: true,
  },
  marketAuthority: {
    type: String,
    required: true,
  },
  marketBaseVault: {
    type: String,
    required: true,
  },
  marketQuoteVault: {
    type: String,
    required: true,
  },
  marketBids: {
    type: String,
    required: true,
  },
  marketAsks: {
    type: String,
    required: true,
  },
  marketEventQueue: {
    type: String,
    required: true,
  },
  lpReserve: {
    type: String,
    required: true,
  },
  solReserve: {
    type: String,
    required: true,
  },
  openTime: {
    type: Date,
    required: true,
  },
  cronStatus: {
    type: String,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('monitorPool', monitorPool);
