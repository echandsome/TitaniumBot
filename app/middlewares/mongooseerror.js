module.exports = function (error) {
  let msg;
  switch (error.constructor.name) {
    case 'CastError':
      msg = error.message;
      break;
    case 'ValidatorError':
      msg = error.message;
      break;
    default:
      msg = error.message;
      break;
  }

  return msg;
};
