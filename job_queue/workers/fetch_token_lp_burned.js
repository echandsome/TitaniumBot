const logger = require('log4js').getLogger('fetch_lp_burn_txn_worker');

const raydiumNewPoolListener = require('../../app/utils/raydium_pool_listener');
const monitorPool = require('../../app/model/monitor_pool');
const PoolData = require('../../app/model/poolData');
const { TIME_THRESHOLD_LP_TOKENS } = require('../../app/utils/pool_filter_params');

const { addJobToSendTransaction, addJobForPriceCron } = require('../add_task');
const queueHelper = require('../utils/queue_helper');
const { SOL_MINT } = require('../../config/envs');

module.exports = async function (job) {
  const {
    lpVault, lpReserve, poolId, startedAt,
  } = job.data;
  try {
    const timePassed = new Date().getTime() - new Date(startedAt).getTime();
    const isLpBurned = await raydiumNewPoolListener.isPoolsLpBurned(lpVault, lpReserve);

    if (isLpBurned === true) {
      // logger.info(`lp burned for ${poolId} initiating token buy process...`);
      const poolBurned = await monitorPool.findOne({
        poolId: poolId,
      }).select('-cronStatus -__v0').lean();

      const { baseMint } = poolBurned;
      const { tokenAddress, lpSolReserve } = baseMint === SOL_MINT
        ? {
          tokenAddress: poolBurned.quoteMint,
          lpSolReserve: poolBurned.baseReserve,
        }
        : {
          tokenAddress: baseMint,
          lpSolReserve: poolBurned.quoteReserve,
        };
      poolBurned.openTime *= 1000;
      delete poolBurned._id;
      const pooldata = await PoolData.create(poolBurned);
      await addJobToSendTransaction({ typeOfTxn: 'Buy', data: { poolId: pooldata._id.toString(), lpSolReserve: lpSolReserve.toString() } });

      await addJobForPriceCron({ tokenAddress: tokenAddress, poolId: pooldata._id.toString() });
      // logger.info(`Deleting cronjob for listening lp burn transaction for Pool Id: ${pooldata.poolId}`);
      await monitorPool.updateOne({ poolId: poolId }, { $set: { cronStatus: false } });
      console.log(await monitorPool.findOne({
        poolId: poolId,
      }));
      const queueName = queueHelper.getQueueNameForTokenLpJobs('RaydiumLp', poolBurned.poolId);
      await queueHelper.deleteQueueInstance(queueName);
      // logger.info(`Deleted cronjob for listening lp burn transaction for Pool Id: ${pooldata.poolId}`);
      return true;
    }

    if (timePassed > TIME_THRESHOLD_LP_TOKENS) {
      logger.info(`Pool burn transaction not found in given time frame deleting cron for ${poolId}`);
      const poolBurned = await monitorPool.findOne({
        poolId: poolId,
      });
      poolBurned.cronStatus = false;
      await poolBurned.save();
      const queueName = queueHelper.getQueueNameForTokenLpJobs('RaydiumLp', poolId);
      queueHelper.deleteQueueInstance(queueName);
    }
    return true;
  } catch (error) {
    logger.error(error);
    console.error('Error occurred in lp burned worker:', error);
    return Promise.reject(error.message);
  }
};
