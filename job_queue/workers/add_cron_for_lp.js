const logger = require('log4js').getLogger('add_lp_cron_worker');
const fetchTokenLpWorker = require('./fetch_token_lp_burned');
const QueueHelper = require('../utils/queue_helper');
const { LP_BURN_CHECK_INTERVAL } = require('../../app/utils/pool_filter_params');

module.exports = async (job) => {
  const {
    lpVault, lpReserve, startedAt, exchange, poolId,
  } = job.data;
  try {
    // logger.info('fetch token lp worker started');

    const QName = QueueHelper.getQueueNameForTokenCronJobs(exchange, poolId);
    const queue = QueueHelper.getQueueInstance(QName);

    const cronJobOptions = {
      repeat: {
        every: LP_BURN_CHECK_INTERVAL,
      },
    };

    // Create the cron job in the Bull Queue
    queue.add({
      startedAt,
      lpVault,
      lpReserve,
      poolId,
    }, cronJobOptions);

    // start processing of Queue
    queue.process((jobObject) => fetchTokenLpWorker(jobObject));

    const message = `Successfully started cron job for check burned lp token ${poolId}`;
    // logger.info(message);
    return Promise.resolve(message);
  } catch (error) {
    job.log(`Error occured ${error}`);
    logger.error(error);
    return Promise.reject(error.message);
  }
};
