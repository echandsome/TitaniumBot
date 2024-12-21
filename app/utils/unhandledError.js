const logger = require('log4js').getLogger('unhandle_errors');

const catchingUnhandledError = () => {
  // catching uncaughtExceptions
  process.on('uncaughtException', (exception) => {
    logger.error('we got an Uncaughted Exception', exception.message, exception);
  });

  // catching unhandledRejection
  process.on('unhandledRejection', (rejection) => {
    logger.error('we got an Unhandled Rejection', rejection);
  });

  // just incase warning are needed to be logged
  process.on('warning', (warning) => {
    logger.warn(warning.stack);
  });
};

module.exports = { catchingUnhandledError };
