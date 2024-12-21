/* eslint-disable no-unused-vars */
const logger = require('log4js').getLogger('error');
const { Error: MongooseError } = require('mongoose');
const { CustomValidationError } = require('../errors/custom_validation_error');
const handleMOnggoseError = require('./mongooseerror');

module.exports = function (err, req, res, next) {
  logger.error(err.message, err);

  // for duplicate key error
  if (err.code === 11000) {
    return res.status(404).send({
      success: false,
      message: `User Already Registered. Please use different ${Object.keys(err.keyPattern).shift().replace('.', ' ')}`,
      error: err,
    });
  }

  if (err instanceof CustomValidationError) {
    return res.status(err.status).send({
      success: false,
      message: err.message,
      error: err,
    });
  }

  if (err instanceof MongooseError) {
    const message = handleMOnggoseError(err);
    return res.status(400).send({
      success: false,
      message: message || err.message,
    });
  }

  // handle invalid JWT authentication errors
  if (err.status === 401) {
    return res.status(401).send({
      success: false,
      message: err.message,
      error: {
        name: err.name,
        code: err.code,
        status: err.status,
      },
    });
  }
  return res.status(500).send({
    success: false,
    message: err.message || err || 'Something went wrong',
    stack: err.stack,
  });
};
