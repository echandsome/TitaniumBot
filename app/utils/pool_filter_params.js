const secondsToMilliseconds = (seconds) => seconds * 1000;
module.exports = {

  NO_OF_WALLETS_TO_HOLD_SUPPLY: 2,
  MAX_PERCENTAGE_HOLDING_THRESHOLD: 100,

  /** Buy tokens
     * If reserve has SOL in between 5 - 10, Swap of 1 sol is executed
     * If reserve has SOL in between 10 - 20, Swap of 2 sol is executed
     * If reserve has SOL in 20 or above, Swap of 5 sol is executed
     */
  AMOUNT_CATEGORY: [100, 200, 300],
  CATEGORY_INVEST_AMOUNT: [0.001, 0.001, 0.001],

  /** Sell tokens
     * If token price increase in between 10 -20, Swap of 5% token for sol is executed
     * If token price increase in between 20 -50, Swap of 20% token for sol is executed
     * If token price incese i 50% or above, Swap of 100% sol is executed
     */
  INCREASE_PERCENTAGE: [10],
  SELL_PERCENTAGE: [100],
  PRICE_CHECK_INTERVAL: secondsToMilliseconds(4), // in seconds
  LP_BURN_CHECK_INTERVAL: secondsToMilliseconds(1), // in Seconds
  TIME_THRESHOLD_SELL_ALL_TOKENS: secondsToMilliseconds(600), // in Seconds
  TIME_THRESHOLD_LP_TOKENS: secondsToMilliseconds(600), // in Seconds
};
