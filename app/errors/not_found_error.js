const { CustomValidationError } = require('./custom_validation_error');

class NotFoundError extends CustomValidationError {
  constructor(message, request_user = null, request_params = null, request_body = null) {
    super(message, 404, 'not_found', request_user, request_params, request_body);

    this.name = 'NotFoundError';
    this.message = message;
    this.status = 404;
    this.code = 'not_found';
  }
}

module.exports = {
  NotFoundError,
};
