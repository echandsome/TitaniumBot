const logger = require('log4js').getLogger('send_txn_worker');
const Transactions = require('../../app/model/transactions');
const RaydiumPoolListener = require('../../app/utils/raydium_pool_listener');
const SolWeb3Helper = require('../../app/utils/solana_web3_helper');
const { addJobForPriceCron } = require('../add_task');

module.exports = async function (job) {
  const { typeOfTxn, data } = job.data;
  let transaction;
  try {
    // logger.info('Worker for sending transaction............');
    console.log(typeOfTxn, data);
    let response;
    switch (typeOfTxn) {
      case 'Buy': {
        response = await RaydiumPoolListener
          .buyTokensForSol(data.poolId, data.lpSolReserve);
        break;
      }
      case 'Sell': {
        response = await RaydiumPoolListener
          .sellTokensForSol(data.poolId, data.tokenAmountToSell, data.sellPercentage);
        break;
      }
      default:
        break;
    }
    if (!response) {
      logger.error(`Sol not enough, Not initiating transaction poolId: ${data.poolId}`);
      return false;
    }
    transaction = await Transactions.findById(response.transactionId);
    // logger.info(`Initiating Transaction to ${typeOfTxn} token from poolId: ${data.poolId}`);
    const signature = await SolWeb3Helper.sendVersionedTransactionToBlockchain(response.ix.instructions);
    if (typeOfTxn === 'Buy') {
      await addJobForPriceCron({ tokenAddress: data.tokenAddress, poolId: data.poolId });
    }
    // logger.info(`Transaction to ${typeOfTxn} token from poolId: ${data.poolId} is success`);
    // logger.info(`Transaction signature: ${signature}`);
    transaction.signature = signature;
    transaction.status = 'Success';
    await transaction.save();
    return 'Transaction sent';
  } catch (error) {
    if (transaction) {
      transaction.status = 'Failed';
      await transaction.save();
    }
    logger.error(error);
    console.log('Error occurred in send v0 transaction worker:', error);
    return Promise.reject(error.message);
  }
};
