const logger = require('log4js').getLogger('add_token_cron_worker');
const fetchTokenPriceWorker = require('./fetch_token_price.worker');
const QueueHelper = require('../utils/queue_helper');
const { PRICE_CHECK_INTERVAL } = require('../../app/utils/pool_filter_params');

module.exports = async (job) => {
  const { tokenAddress, exchange, poolId } = job.data;
  try {
    // logger.info('fetch price worker started');
    console.log(exchange);

    const QName = QueueHelper.getQueueNameForTokenCronJobs(exchange, tokenAddress);
    const queue = QueueHelper.getQueueInstance(QName);

    const cronJobOptions = {
      repeat: {
        every: PRICE_CHECK_INTERVAL,
      },
    };

    // Create the cron job in the Bull Queue
    queue.add({
      tokenAddress,
      poolId,
    }, cronJobOptions);

    // start processing of Queue
    queue.process((jobObject) => fetchTokenPriceWorker(jobObject));

    const message = `Successfully started cron job for token ${tokenAddress}`;
    // logger.info(message);
    return Promise.resolve(message);
  } catch (error) {
    job.log(`Error occured ${error}`);
    logger.error(error);
    return Promise.reject(error.message);
  }
};
