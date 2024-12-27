/* eslint-disable max-len */
const logger = require('log4js').getLogger('Q_add_task');
const {
  poolQ,
  findNewPoolTxnQ,
  parseNewPoolTxnQ,
  addPriceCronQ,
  sendTxnQ,
  addLpBurnCronQ,
} = require('./process_manager');

module.exports = {

  addJobForNewPool: async () => {
    await poolQ.add({});
  },
  addJobToSendTransaction: async ({ typeOfTxn, data }) => {
    sendTxnQ.add({
      typeOfTxn,
      data,
    });
  },

  addJobForFindNewPool: async (data) => {
    // console.log('Added job for checking if transaction is ')
    await findNewPoolTxnQ.add({ signature: data.signature, logs: data.logs });
  },
  addJobForParseNewPoolTxn: async (data) => {
    await parseNewPoolTxnQ.add({ mintAddress: data.mintAddress, isBurned: data.isBurned });
  },
  addJobForPriceCron: async (data) => {
    await addPriceCronQ.add({ tokenAddress: data.tokenAddress, exchange: 'Raydium', poolId: data.poolId });
    // logger.info(`Added cron to fetch price of ${data.poolId}, tokenAddress: ${data.tokenAddress}`);
  },

  addJobForLpBurnedCron: async (data) => {
    await addLpBurnCronQ.add({
      startedAt: data.startedAt,
      lpVault: data.lpVault,
      lpReserve: data.lpReserve,
      exchange: 'RaydiumLp',
      poolId: data.poolId,
    });
  },
  bullQueueSchedulers: async (data) => {
    await poolQ.add({
      ...data,
    });
  },

};
