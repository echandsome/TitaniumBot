const logger = require('log4js').getLogger('fetch_token_price_worker');
const { default: axios } = require('axios');
const SplToken = require('../../app/model/splToken');
const Transactions = require('../../app/model/transactions');
const SolWeb3Helper = require('../../app/utils/solana_web3_helper');
const { SELL_PERCENTAGE, INCREASE_PERCENTAGE, TIME_THRESHOLD_SELL_ALL_TOKENS } = require('../../app/utils/pool_filter_params');
const { addJobToSendTransaction } = require('../add_task');
const queueHelper = require('../utils/queue_helper');
const { BIRDEYE_API_KEY, BIRDEYE_BASE_URL } = require('../../config/envs');

const findElement = function (arr, target) {
  let start = 0;
  let end = arr.length - 1;
  let result = 0;
  let index = -1;

  while (start <= end) {
    const mid = Math.floor((start + end) / 2);
    if (arr[mid] <= target) {
      result = arr[mid];
      index = mid;
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }
  return { result, index };
};

module.exports = async function (job) {
  const { tokenAddress, poolId } = job.data;
  try {
    let response;

    let splToken = await SplToken.findOne({
      mintAddress: tokenAddress,
    });
    const splTokenNotAvailable = !splToken;
    if (splTokenNotAvailable) {
      splToken = await SplToken.create({
        poolId,
        mintAddress: tokenAddress,
        initialPrice: 0,
      });
    }

    try {
      response = await axios.get(`${BIRDEYE_BASE_URL}?address=${tokenAddress}`, {
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY,
        },
      });
    } catch (error) {
      logger.error(`Enable to fetch price, error: ${error.message}`);
    }

    let priceData = response?.data;

    let price = priceData?.data?.value;

    if (!price) {
      try {
        response = await axios.get(`${BIRDEYE_BASE_URL}?address=${tokenAddress}`, {
          headers: {
            'X-API-KEY': BIRDEYE_API_KEY,
          },
        });
      } catch (error) {
        logger.error(`Enable to fetch price, error: ${error.message}`);
      }
  
      priceData = response?.data;
  
      price = priceData?.data?.value;
    }

    if(!price){
      return false;
    }

    if (splTokenNotAvailable || splToken.initialPrice === '0') {
      splToken.initialPrice = price;
      await splToken.save();
      // logger.info(`Token ${splToken.mintAddress} initial price is: ${splToken.initialPrice}`);
      return false;
    }

    const balanceData = await SolWeb3Helper.getTokenBalanceByMintAddress(tokenAddress) || { amount: '0' };

    const tokenBalance = BigInt(balanceData.amount);
    const timePassed = new Date().getTime() - splToken.createdAt.getTime();

    if (balanceData.amount === '0' && timePassed >= 300000) {
      // logger.info(`Balance too low of token: ${balanceData.amount} after five minutes, removing token cron job`);
      splToken.cronStatus = false;
      await splToken.save();
      const queueName = queueHelper.getQueueNameForTokenCronJobs('Raydium', tokenAddress);
      await queueHelper.deleteQueueInstance(queueName);
    }
    if (balanceData.amount === '0') {
      return false;
    }

    if (timePassed >= TIME_THRESHOLD_SELL_ALL_TOKENS) {
      // logger.info(`Time threshold reached, selling all the tokens, poolId: ${poolId}`);
      await addJobToSendTransaction({ typeOfTxn: 'Sell', data: { poolId: poolId, tokenAmountToSell: tokenBalance.toString(), sellPercentage: 0 } });
      splToken.cronStatus = false;
      await splToken.save();
      const queueName = queueHelper.getQueueNameForTokenCronJobs('Raydium', tokenAddress);
      await queueHelper.deleteQueueInstance(queueName);
      return true;
    }

    const oldPrice = parseFloat(splToken.initialPrice, 10);

    const changeInPrice = price - oldPrice;
    const changeInPricePerc = (changeInPrice / oldPrice) * 100;

    if(changeInPricePerc<-10){
      // logger.info(`Price is falling, selling all the tokens, poolId: ${poolId}`);
      await addJobToSendTransaction({ typeOfTxn: 'Sell', data: { poolId: poolId, tokenAmountToSell: tokenBalance.toString(), sellPercentage: changeInPricePerc } });
      splToken.cronStatus = false;
      await splToken.save();
      const queueName = queueHelper.getQueueNameForTokenCronJobs('Raydium', tokenAddress);
      await queueHelper.deleteQueueInstance(queueName);
      return true;
    }

    // logger.info(
    //   `\nPrice change percentage: ${changeInPricePerc}% \ntoken: ${splToken.mintAddress} \nCurrent price: ${price} Initial price: ${oldPrice}`,
    // );

    console.log('Array of percentage:', INCREASE_PERCENTAGE, '\nElement:', findElement(INCREASE_PERCENTAGE, changeInPricePerc));
    const { result, index } = findElement(INCREASE_PERCENTAGE, changeInPricePerc);
    if (index === -1) {
      return `Price change percentage is low: ${changeInPricePerc}`;
    }

    // logger.info(`Price change percentage is: ${changeInPricePerc}% for token: ${splToken?.mintAddress} Initiating transaction`);
    // logger.info(`Selling percentage is: ${result}`);
    // const transactionDetails = await Transactions.findOne({
    //   poolId: poolId,
    //   type: 'Sell',
    //   status: 'Success',
    //   soldForProfitPerc: { $gte: result },
    // });

    // if (transactionDetails) {
    //   logger.info(`Sale already happened for bigger profit percentage: ${transactionDetails?.soldForProfitPerc}%`);
    //   return false;
    // }

    const tokensToSell = (BigInt(SELL_PERCENTAGE[index]) * tokenBalance) / BigInt(100);
    await addJobToSendTransaction(
      { typeOfTxn: 'Sell', data: { poolId: poolId, tokenAmountToSell: tokensToSell.toString(), sellPercentage: result } },
    );
    splToken.cronStatus = false;
    await splToken.save();
    const queueName = queueHelper.getQueueNameForTokenCronJobs('Raydium', tokenAddress);
    await queueHelper.deleteQueueInstance(queueName);
    return 'Job completed';
  } catch (error) {
    logger.error(error);
    console.error('Error occurred:', error);
    return Promise.reject(error.message);
  }
};
