const mongoose = require('mongoose');

const { SALT_ROUNDS } = require('../../config/envs');

const { Schema } = mongoose;

const userSchema = new Schema({

  username: {
    type: String,
    unique: [true, 'Username is already taken'],
    required: [true, 'Username is required'],
  },
  password: {
    type: String,
    required: true,
  },
  last_login: {
    type: Date,
    default: new Date(),
  },
  last_logout: {
    type: Date,
    default: new Date(),
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Users', userSchema);
