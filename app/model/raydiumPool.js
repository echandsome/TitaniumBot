const mongoose = require('mongoose');

const { Schema } = mongoose;

const raydiumPool = new Schema({

  poolId: {
    type: String,
  },
  baseMint: {
    type: String,
  },
  quoteMint: {
    type: String,
  },
  rawData: {
    type: String,
  },
  baseVault: {
    type: String,
  },
  quoteVault: {
    type: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('raydiumPool', raydiumPool);
