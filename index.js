const log4js = require('log4js');
const server = require('./app/server');
const { PORT } = require('./config/envs');
const logConfig = require('./config/logConfig');

const { startBullQWorkers } = require('./job_queue/process_workers');
const { catchingUnhandledError } = require('./app/utils/unhandledError');
const telegramListener = require('./app/utils/telegram_listener');

log4js.configure(logConfig);
server.listen(PORT, async () => {
  catchingUnhandledError();
  // log4js.getLogger('Server').debug(`Server started on port ${PORT}`);
  await startBullQWorkers();
  telegramListener.start();
});
