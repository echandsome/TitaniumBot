const logger = require('log4js').getLogger('Q_process_worker');
const findNewPoolWorker = require('./workers/find_pool_init_txn.worker');
const parseNewPoolTxnWoker = require('./workers/parse_init_pool_txn.worker');
const addCronForTokenPriceWorker = require('./workers/add_cron_for_price');
const sendV0TxnWorker = require('./workers/send_v0_txn.worker');
const addCronForLpBurn = require('./workers/add_cron_for_lp');

const {
  findNewPoolTxnQ,
  parseNewPoolTxnQ,
  addPriceCronQ,
  sendTxnQ,
  addLpBurnCronQ,
  tokenPricesQs,
  removeQDataQ,
} = require('./process_manager');
const fetchTokenPriceWorker = require('./workers/fetch_token_price.worker');

// eslint-disable-next-line no-unused-vars
const removeQdataWorker = async (job) => {
  findNewPoolTxnQ.clean(0, 'completed');
};
module.exports = {
  startBullQWorkers: async () => {
    // logger.info('Job Queue workers is being started...');
    findNewPoolTxnQ.process(20, (job) => findNewPoolWorker(job));
    parseNewPoolTxnQ.process(1, (job) => parseNewPoolTxnWoker(job));
    addPriceCronQ.process((job) => addCronForTokenPriceWorker(job));
    sendTxnQ.process((job) => sendV0TxnWorker(job));
    addLpBurnCronQ.process((job) => addCronForLpBurn(job));

    const tokenPricesCronQs = await tokenPricesQs();
    tokenPricesCronQs.forEach((tokenQ) => {
      tokenQ.process(
        (job) => fetchTokenPriceWorker(job),
      );
    });

    removeQDataQ.process((job) => removeQdataWorker(job));
    removeQDataQ.add({}, {
      repeat: {
        every: 10000,
      },
    });

    findNewPoolTxnQ.clean(0, 'completed');
  },
};
