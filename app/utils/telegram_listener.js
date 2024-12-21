/* eslint-disable max-len */
const logger = require('log4js').getLogger('telegram_listener');

const {
  TelegramClient,
} = require('telegram');

const {
  NewMessage,
} = require('telegram/events');

const {
  StringSession,
} = require('telegram/sessions');
const { LIQUIDITY_STATE_LAYOUT_V4, MARKET_STATE_LAYOUT_V3, Market } = require('@raydium-io/raydium-sdk');
const solanaWeb3Helper = require('./solana_web3_helper');
const {
  RAYDIUM_POOL_V4_PROGRAM_ID, SOL_MINT, RAYDIUM_AMM_AUTHORITY, TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_STRING_SESSION,
} = require('../../config/envs');
const { addJobForParseNewPoolTxn } = require('../../job_queue/add_task');
const raydium_pool_listener = require('./raydium_pool_listener');

function messageToKeyValueObject(message) {
  // Split the message by lines

  const data = {};
  message.split('\n').forEach((line) => {
    if (line.includes('|')) {
      line.split('|').forEach((pipeLine) => {
        const [key, value] = pipeLine.trim().split(':', 2);

        if (key) {
          data[key] = value ? (value.trim() === '✅' ? true : (value.trim() === '❌' ? false : value.trim())) : '';
        }
      });
      return;
    }
    const [key, value] = line.trim().split(':', 2);
    if (key) {
      data[key] = value ? value.trim() : '';
    }
  });
  return data;
}

class TelegramListener {
  constructor() {
    this.client = new TelegramClient(
      new StringSession(TELEGRAM_STRING_SESSION),
      TELEGRAM_API_ID,
      TELEGRAM_API_HASH,
      {},
    );
  }

  async start() {
    await this.client.connect();
    await this.client.sendMessage('me', {
      message: 'Hello',
    });
    this.client.addEventHandler(this.handler, new NewMessage({ fromUsers: ['@bonkbot_alerts_bot'] }));
  }

  async fetchPoolKeysForMintAddress(mintAddress) {
    // logger.info(`Parsing account for: ${mintAddress}`);
    const programAccount = await this.findPoolAddressForMintAddress(mintAddress, SOL_MINT)
    || await this.findPoolAddressForMintAddress(SOL_MINT, mintAddress);

    const poolInfo = LIQUIDITY_STATE_LAYOUT_V4.decode(programAccount.account.data);

    const solVault = poolInfo.baseMint.toBase58() === SOL_MINT ? poolInfo.baseVault : poolInfo.quoteVault;
    const solBalance = await solanaWeb3Helper.connection.getTokenAccountBalance(solVault, 'confirmed');
    const marketInfo = await raydium_pool_listener.fetchMarketInfo(poolInfo.marketId);
    const poolKeys = {
      poolId: programAccount.pubkey,
      baseMint: poolInfo.baseMint,
      quoteMint: poolInfo.quoteMint,
      lpMint: poolInfo.lpMint,
      baseDecimals: poolInfo.baseDecimal.toNumber(),
      quoteDecimals: poolInfo.quoteDecimal.toNumber(),
      lpDecimals: 9,
      version: 4,
      programId: solanaWeb3Helper.getPubkey(RAYDIUM_POOL_V4_PROGRAM_ID),
      openOrders: poolInfo.openOrders,
      targetOrders: poolInfo.targetOrders,
      baseVault: poolInfo.baseVault,
      quoteVault: poolInfo.quoteVault,
      withdrawQueue: poolInfo.withdrawQueue,
      lpVault: poolInfo.lpVault,
      marketVersion: 3,
      authority: solanaWeb3Helper.getPubkey(RAYDIUM_AMM_AUTHORITY),
      marketId: poolInfo.marketId,
      marketProgramId: poolInfo.marketProgramId,
      marketAuthority: Market.getAssociatedAuthority({ programId: poolInfo.marketProgramId, marketId: poolInfo.marketId }).publicKey,
      marketBaseVault: marketInfo.baseVault,
      marketQuoteVault: marketInfo.quoteVault,
      marketBids: marketInfo.bids,
      marketAsks: marketInfo.asks,
      marketEventQueue: marketInfo.eventQueue,
      solReserve: solBalance.value.amount,
      lpReserve: poolInfo.lpReserve.toNumber(),
      openTime: poolInfo.poolOpenTime.toNumber(),
    };
    return poolKeys;
  }

  async handler(event) {
    const msg = event.message.message;
    console.log('We got a new message from channel....');

    const NewpoolRegex = /⚡ NEW POOL ⚡[\s\S]*?Mint: (.+)$/m;
    let NewpoolMatch = msg.match(NewpoolRegex);
    // if(String(msg).includes("NEW POOL")) NewpoolMatch=true;
    if (NewpoolMatch) {
      const poolData = messageToKeyValueObject(msg);
      const isPoolsLpBurnedRenounced = poolData.Burned && poolData.Renounced;
      const isPoolOpen = poolData['Open time'].includes('just created')
        || poolData['Open time'].includes('ago');
      if (isPoolsLpBurnedRenounced && isPoolOpen) {
        // logger.info(`${poolData.Ticker} New pool`);
        addJobForParseNewPoolTxn({ mintAddress: poolData.Mint, isBurned: true });
      }
      if (poolData.Renounced && !poolData.Burned) {
        // logger.info(`${poolData.Ticker} New pool`);
        addJobForParseNewPoolTxn({ mintAddress: poolData.Mint, isBurned: false });
      }
      console.log(poolData);
      return;
    }

    const burnRenouncedRegex = /🔥 BURNED LP 🔥[\s\S]*?Mint: (.+)$/m;
    let burnRenouncedMatch = msg.match(burnRenouncedRegex);
    // if(String(msg).includes("BURNED LP")) burnRenouncedMatch=true;
    if (burnRenouncedMatch) {
      const poolData = messageToKeyValueObject(msg);
      const isPoolsLpBurnedRenounced = poolData.Burned && poolData.Renounced;
      const isPoolOpen = poolData['Open time'].includes('just created')
        || poolData['Open time'].includes('ago');
      if (isPoolsLpBurnedRenounced && isPoolOpen) {
        // logger.info(`${poolData.Ticker} is burned successfully`);
        addJobForParseNewPoolTxn({ mintAddress: poolData.Mint, isBurned: true });
      }
      console.log(poolData)
    }
  }

  async fetchOpenbookPoolAddress(mintA, mintB) {
    const accounts = await solanaWeb3Helper.connection.getProgramAccounts(
      solanaWeb3Helper.getPubkey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'),
      {
        commitment: 'finalized',
        filters: [
          { dataSize: MARKET_STATE_LAYOUT_V3.span },
          {
            memcmp: {
              offset: MARKET_STATE_LAYOUT_V3.offsetOf('baseMint'),
              bytes: mintA,
            },
          },
          {
            memcmp: {
              offset: MARKET_STATE_LAYOUT_V3.offsetOf('quoteMint'),
              bytes: mintB,
            },
          },
        ],
      },
    );
    if (accounts.length > 0) return accounts[0];
    return null;
  }

  async findPoolAddressForMintAddress(mintA, mintB) {
    const accounts = await solanaWeb3Helper.connection.getProgramAccounts(
      solanaWeb3Helper.getPubkey(RAYDIUM_POOL_V4_PROGRAM_ID),
      {
        commitment: 'confirmed',
        filters: [
          { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
          {
            memcmp: {
              offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'),
              bytes: mintA,
            },
          },
          {
            memcmp: {
              offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
              bytes: mintB,
            },
          },
        ],
      },
    );
    if (accounts.length > 0) return accounts[0];
    return null;
  }
}

module.exports = new TelegramListener();
