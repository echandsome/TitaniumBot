const logger = require('log4js').getLogger('queue_helper');
const BullQueue = require('bull');
const { ExpressAdapter } = require('@bull-board/express');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
// const { getLogger } = require('log4js');
const { REDIS_HOST, REDIS_PORT } = require('../../config/envs');

class QueueHelper {
  constructor() {
    this.serverAdapter = new ExpressAdapter();
    this.bullBoard = createBullBoard({
      queues: [],
      serverAdapter: this.serverAdapter,
    });
  }

  getServerAdapter() {
    return this.serverAdapter;
  }

  getBullBoard() {
    return this.bullBoard;
  }

  getQueueNameForTokenCronJobs(exchange, tokenAddress) {
    return `${exchange}:${tokenAddress}`;
  }

  getQueueNameForTokenLpJobs(exchange, tokenAddress) {
    return `${exchange}:${tokenAddress}`;
  }

  getQueueInstance(queueName) {
    const redisConnectOptions = {
      host: REDIS_HOST || '',
      port: parseInt(REDIS_PORT || '6379', 10),
    };
    const Q = new BullQueue(queueName, { redis: redisConnectOptions });
    this.addQueueToBullBoard(Q).catch((err) => {
      logger.error(`Problem while adding queue: ${err.message}`);
    });
    return Q;
  }

  async deleteQueueInstance(queueName) {
    const queue = this.getQueueInstance(queueName);
    await queue.obliterate({ force: true });
    this.deleteQueueFromBullBoard(queue).catch((err) => {
      logger.error(`Problem while deleting queue: ${err.message}`);
    });
    return true;
  }

  async deleteQueueFromBullBoard(queueInstance) {
    this.bullBoard.removeQueue(new BullAdapter(queueInstance));
  }

  async addQueueToBullBoard(queueInstance) {
    this.bullBoard.addQueue(new BullAdapter(queueInstance));
  }
}

const QHelper = new QueueHelper();

module.exports = QHelper;
