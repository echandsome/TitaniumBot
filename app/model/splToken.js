const mongoose = require('mongoose');

const { Schema } = mongoose;

const splToken = new Schema({

  poolId: {
    type: Schema.Types.ObjectId,
    ref: 'PoolData',
    required: true,
  },
  mintAddress: {
    type: String,
    required: true,
  },
  initialPrice: {
    type: String,
    required: true,
  },
  cronStatus: {
    type: String,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('spltoken', splToken);
