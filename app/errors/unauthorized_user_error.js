const { CustomValidationError } = require('./custom_validation_error');

class UnauthorizedUserError extends CustomValidationError {
  constructor(message, request_user = null, request_params = null, request_body = null) {
    super(message, 403, 'unauthorized_user_access', request_user, request_params, request_body);

    this.name = 'UnauthorizedUserError';
    this.status = 403;
    this.code = 'unauthorized_user_access';
  }
}

module.exports = {
  UnauthorizedUserError,
};
