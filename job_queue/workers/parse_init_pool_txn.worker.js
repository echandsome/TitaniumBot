const logger = require('log4js').getLogger('parse_pool_txn_worker');
const PoolData = require('../../app/model/poolData');
const monitorPool = require('../../app/model/monitor_pool');
const { addJobToSendTransaction } = require('../add_task');
const { SOL_MINT } = require('../../config/envs');
const telegramListener = require('../../app/utils/telegram_listener');
const { TIME_THRESHOLD_LP_TOKENS } = require('../../app/utils/pool_filter_params');

module.exports = async function (job) {
  const { mintAddress, isBurned } = job.data;
  try {
    if (isBurned) {
      const pool = await monitorPool.findOne({ $or: [{ quoteMint: mintAddress }, { baseMint: mintAddress }] });
      if (pool && pool.createdAt.getTime() >= (Date.now() - TIME_THRESHOLD_LP_TOKENS)) {
        // logger.info(`Lp burned after Threshold time removed from monitor list, ${pool.poolId}`);
        await pool.delete();
        return false;
      }
    }
    const poolKeys = await telegramListener.fetchPoolKeysForMintAddress(mintAddress);
    // logger.info(`Parsed account details for pool id: ${poolKeys.poolId}`);

    const tokenAddress = poolKeys.baseMint.toBase58() === SOL_MINT ? poolKeys.quoteMint : poolKeys.baseMint;
    const plainPoolKeys = JSON.parse(JSON.stringify(poolKeys));
    plainPoolKeys.openTime *= 1000;

    if (!isBurned) {
      const pool = await monitorPool.create(plainPoolKeys);
      // logger.info(`Pool Added for lp Burn monitoring, pool id: ${pool.poolId}`);
      return false;
    }

    const poolData = await PoolData.findOne({ poolId: plainPoolKeys.poolId }) || await PoolData.create(plainPoolKeys);

    await addJobToSendTransaction({ typeOfTxn: 'Buy', data: { poolId: poolData._id.toString(), lpSolReserve: poolKeys.solReserve, tokenAddress } });
    return true;
  } catch (error) {
    logger.error(error);
    console.error('Error occurred:', error);
    return Promise.reject(error.message);
  }
};
// module.exports = async function (job) {
//   const { signature } = job.data;
//   try {
//     logger.info('Worker for parsing transaction............');

//     const poolKeys = await raydiumPoolListener.fetchPoolKeysForLPInitTransactionHash(signature);
//     logger.info(`Parsed transction for pool id: ${poolKeys.poolId} & signature: ${signature}`);
//     const baseMint = poolKeys.baseMint.toBase58();

//     const { tokenAddress, lpSolReserve } = baseMint === SOL_MINT
//       ? {
//         tokenAddress: poolKeys.quoteMint.toBase58(),
//         lpSolReserve: poolKeys.baseReserve.toString(),
//       }
//       : {
//         tokenAddress: baseMint,
//         lpSolReserve: poolKeys.quoteReserve.toString(),
//       };
//     const plainPoolKeys = JSON.parse(JSON.stringify(poolKeys));
//     plainPoolKeys.openTime *= 1000;

//     const { conditionMatchedExceptLpBurned, isLpBurned } = await raydiumPoolListener
//       .isPoolValidToMonitor(tokenAddress, poolKeys.openTime, poolKeys.lpVault.toBase58(), poolKeys.lpReserve);

//     if (!conditionMatchedExceptLpBurned) {
//       logger.error(`Pool ${poolKeys.poolId} failed validations`);
//       return false;
//     }
//     if (conditionMatchedExceptLpBurned && isLpBurned === false) {
//       logger.info(`Starting lp burn monitoring for ${poolKeys.poolId}`);
//       const lpToken = await monitorPool.create(plainPoolKeys);
//       await addJobForLpBurnedCron({
//         startedAt: lpToken.createdAt,
//         lpVault: poolKeys.lpVault.toBase58(),
//         lpReserve: poolKeys.lpReserve,
//         poolId: lpToken.poolId,
//       });
//       return false;
//     }
//     const poolData = await PoolData.create(plainPoolKeys);
//     await addJobToSendTransaction({ typeOfTxn: 'Buy', data: { poolId: poolData._id.toString(), lpSolReserve: lpSolReserve } });

//     await addJobForPriceCron({ tokenAddress: tokenAddress, poolId: poolData._id.toString() });
//     return 'Job completed';
//   } catch (error) {
//     logger.error(error);
//     console.error('Error occurred:', error);
//     return Promise.reject(error.message);
//   }
// };
