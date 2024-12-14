const mongoose = require('mongoose');
const logger = require('log4js').getLogger('db_connection');

const { MONGODB_CONNECTION_STRING } = require('./envs');

module.exports = function (connectionString = MONGODB_CONNECTION_STRING) {
  mongoose.set('strictQuery', false);
  mongoose.connect(
    connectionString,
  ).then(() => {
    // logger.info('Connected to MongoDB...');
  });
  mongoose.connection.on('connected', () => {
    // logger.info('Mongo database connected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error(err.message, err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.error('Mongoose default connection is disconnected');
  });

  process.on('SIGINT', () => {
    mongoose.connection.close(() => {
      logger.error('Mongoose default connection is disconnected, due to application termination');
      process.exit(0);
    });
  });
};
