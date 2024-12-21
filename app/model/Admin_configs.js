const mongoose = require('mongoose');

const { Schema } = mongoose;

const adminConfigSchema = new Schema({

  minimum_difference: {
    type: Number,
    required: true,
  },
  max_token_limit: {
    type: Number,
    required: true,
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('AdminConfigs', adminConfigSchema);
