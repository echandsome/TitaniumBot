const mongoose = require('mongoose');

const { Schema } = mongoose;

const transactionSchema = new Schema({
  poolId: {
    type: Schema.Types.ObjectId,
    ref: 'PoolData',
    required: true,
  },
  type: {
    type: String,
    enum: ['Buy', 'Sell'],
  },
  signature: {
    type: String,
  },
  status: {
    type: String,
    enum: ['Pending', 'Success', 'Failed'],
  },
  soldForProfitPerc: {
    type: Number,
  },
  solAmount: {
    type: String,
  },
  tokenAmount: {
    type: String,
  },
});

module.exports = mongoose.model('Transactions', transactionSchema);
