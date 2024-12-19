class CustomValidationError extends Error {
  constructor(
    message,
    status,
    code,
    request_user = null,
    request_params = null,
    request_body = null,
  ) {
    super(message, status, code, request_user, request_params, request_body);

    this.name = 'CustomValidationError';
    this.message = message;
    this.status = status;
    this.code = code;
    this.request_user = request_user;
    this.request_params = request_params;
    this.request_body = request_body;
  }
}

module.exports = {
  CustomValidationError,
};
