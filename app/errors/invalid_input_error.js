const { CustomValidationError } = require('./custom_validation_error');

class InvalidInputError extends CustomValidationError {
  constructor(message, request_user = null, request_params = null, request_body = null) {
    super(message, 400, 'invalid_input', request_user, request_params, request_body);

    this.name = 'InvalidInputError';
    this.status = 400;
    this.code = 'invalid_input';
  }
}

module.exports = {
  InvalidInputError,
};
