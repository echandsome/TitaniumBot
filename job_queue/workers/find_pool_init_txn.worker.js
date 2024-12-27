const logger = require('log4js').getLogger('find_pool_init_txn_worker');
const { addJobForParseNewPoolTxn } = require('../add_task');

module.exports = async function (job) {
  const { signature, logs } = job.data;
  try {
    if (logs && logs.some((log) => log.includes('initialize2'))) {
      logger.info('New pool init transaction found at...........', new Date().toString());
      await addJobForParseNewPoolTxn({ signature });
    }

    return 'Job completed';
  } catch (error) {
    logger.error(error);
    console.error('Error occurred:', error);
    return Promise.reject(error.message);
  }
};
