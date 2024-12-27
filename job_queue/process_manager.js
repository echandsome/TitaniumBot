// Create a file, let's say app.js

const QHelper = require('./utils/queue_helper');
const SplToken = require('../app/model/splToken');
// Get the queue instance
const removeQDataQ = QHelper.getQueueInstance('removeQDataQ');
const findNewPoolTxnQ = QHelper.getQueueInstance('findNewPoolTxnQ');
const parseNewPoolTxnQ = QHelper.getQueueInstance('parseNewPoolTxnQ');
const addPriceCronQ = QHelper.getQueueInstance('addPriceCronQ');
const sendTxnQ = QHelper.getQueueInstance('sendTxnQ');
const addLpBurnCronQ = QHelper.getQueueInstance('addLpBurnCronQ');

const tokenPricesQs = async () => {
  const tokens = await SplToken.find({ cronStatus: true });

  const Qs = tokens.map((token) => {
    const QName = QHelper.getQueueNameForTokenCronJobs('Raydium', token.mintAddress);
    const queue = QHelper.getQueueInstance(QName);
    return queue;
  }) || [];
  return Qs;
};

// Get the server adapter
const serverAdapter = QHelper.getServerAdapter();

module.exports = {
  serverAdapter,
  removeQDataQ,
  findNewPoolTxnQ,
  parseNewPoolTxnQ,
  addPriceCronQ,
  sendTxnQ,
  addLpBurnCronQ,
  tokenPricesQs,
};
