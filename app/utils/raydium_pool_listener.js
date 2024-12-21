const logger = require('log4js').getLogger('raydium_new_pool_listener');
const {
  MARKET_STATE_LAYOUT_V3, Market, TOKEN_PROGRAM_ID, jsonInfo2PoolKeys, Liquidity, LIQUIDITY_STATE_LAYOUT_V4, MAINNET_PROGRAM_ID,
} = require('@raydium-io/raydium-sdk');
const {
  PublicKey, Transaction, SystemProgram, ComputeBudgetProgram,
} = require('@solana/web3.js');
const {
  getAssociatedTokenAddress,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  createAssociatedTokenAccountInstruction,
} = require('@solana/spl-token');
const base58 = require('bs58');
const SolWeb3Helper = require('./solana_web3_helper');
const { addJobForFindNewPool } = require('../../job_queue/add_task');
const poolData = require('../model/poolData');
const { AMOUNT_CATEGORY, CATEGORY_INVEST_AMOUNT } = require('./pool_filter_params');
const { RAYDIUM_POOL_V4_PROGRAM_ID, SOL_MINT, SOL_DECIMALS } = require('../../config/envs');
const Transactions = require('../model/transactions');

const seenTransactions = [];
const findElement = function (arr, target) {
  let start = 0;
  let end = arr.length - 1;
  let result = 0;
  let index = -1;
  index=0;

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
class RaydiumNewPoolListener {
  constructor() {
    this.SESSION_HASH = `QNDEMO${Math.ceil(Math.random() * 1e9)}`;
    this.connection = SolWeb3Helper.connection;
  }

  async isPoolValidToMonitor(tokenAddress, openTime, lpTokenAccount, lpAmountMinted) {
    const tokenAddressPubkey = SolWeb3Helper.getPubkey(tokenAddress);
    const { status, totalSupply } = await SolWeb3Helper.isMintAuthorityRevoked(tokenAddressPubkey);
    const isTopAccountHolderInThreshold = await SolWeb3Helper.isTopTokenHolderPercentageUnderThreshold(tokenAddressPubkey, totalSupply);
    const openTimeInDateformat = new Date(openTime * 1000);
    const timeLeftToOpen = openTimeInDateformat.getTime() - new Date().getTime();
    const isLpBurned = await this.isPoolsLpBurned(lpTokenAccount, lpAmountMinted);
    // logger.info(` mintAuthorityRevoked: ${status}, TopTokenHoldersUnderThreshold: ${isTopAccountHolderInThreshold}`);
    // logger.info(` openTime: ${timeLeftToOpen}, lpBurned: ${isLpBurned}`);
    const three = (status === true && (timeLeftToOpen <= 0));
    return {
      conditionMatchedExceptLpBurned: three,
      isLpBurned,
    };
  }

  listenNewPools() {
    this.connection.onLogs(new PublicKey(RAYDIUM_POOL_V4_PROGRAM_ID), async (txLogs) => {
      if (seenTransactions.includes(txLogs.signature)) {
        return;
      }
      seenTransactions.push(txLogs.signature);
      await addJobForFindNewPool(txLogs);
    });
    // logger.info('Listening to new pools.........');
  }

  async testListenPools() {
    this.connection.onProgramAccountChange(
      new PublicKey(RAYDIUM_POOL_V4_PROGRAM_ID),
      async (updtedAccountInfo) => {
        console.log('Fetched something', updtedAccountInfo.accountId.toBase58());
        const data = LIQUIDITY_STATE_LAYOUT_V4.decode(updtedAccountInfo.accountInfo.data);
        console.log(data);
      },
      'finalized',
      [
        { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('poolOpenTime'),
            bytes: base58.encode([Date.now() / 1000]),
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('marketProgramId'),
            bytes: MAINNET_PROGRAM_ID.OPENBOOK_MARKET.toBase58(),
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('status'),
            bytes: base58.encode([6, 0, 0, 0, 0, 0, 0, 0]),
          },
        },
      ],
    );
  }

  async buyTokensForSol(poolId, lpSolReserve) {
    const totalAmount = BigInt(lpSolReserve) / BigInt(10 ** SOL_DECIMALS);
    const { index } = findElement(AMOUNT_CATEGORY, totalAmount);
    // logger.info(`\nSol reserve: ${totalAmount} \nAmount Index: ${index} \nFor poolId: ${poolId}`);
    if (index === -1) {
      return null;
    }
    // logger.info(`Amount available in vault: ${totalAmount} for poolId: ${poolId}`);

    const solToSell = SolWeb3Helper.parseUnits(CATEGORY_INVEST_AMOUNT[index].toString(), SOL_DECIMALS);
    const ix = await this.swapTokens(poolId, solToSell, false);
    const txn = await Transactions.create({
      poolId: poolId,
      type: 'Buy',
      status: 'Pending',
      solAmount: solToSell.toString(),
    });

    return { ix: ix, transactionId: txn._id.toString() };
  }

  async sellTokensForSol(poolId, tokenAmountToSell, sellPercentage) {
    const ix = await this.swapTokens(poolId, tokenAmountToSell, true);
    const txn = await Transactions.create({
      poolId: poolId,
      type: 'Sell',
      status: 'Pending',
      soldForProfitPerc: sellPercentage,
      tokenAmount: tokenAmountToSell.toString(),
    });

    return { ix: ix, transactionId: txn._id.toString() };
  }

  async swapTokens(poolId, amountIn, buySol = false) {
    const poolKeys = await poolData.findById(poolId)
      .select('-createdAt -updatedAt -lpReserve -solReserve -openTime')
      .lean();
    const id = poolKeys.poolId;
    delete poolKeys.poolId;
    delete poolKeys._id;
    poolKeys.id = id;

    const baseMintAddress = poolKeys.baseMint;
    const tokenAddress = baseMintAddress === SOL_MINT ? poolKeys.quoteMint : baseMintAddress;

    const pool = jsonInfo2PoolKeys(JSON.parse(JSON.stringify(poolKeys)));
    const txObject = new Transaction();

    const solATA = await getAssociatedTokenAddress(
      SolWeb3Helper.getPubkey(SOL_MINT),
      SolWeb3Helper.signer.publicKey,
    );
    const accountInfo = await this.connection.getAccountInfo(solATA);
    txObject.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2000000 }));
    if (accountInfo) {
      txObject.add(
        createCloseAccountInstruction(
          solATA,
          SolWeb3Helper.signer.publicKey,
          SolWeb3Helper.signer.publicKey,
          [SolWeb3Helper.signer],
        ),
      );
    }
    txObject.add(createAssociatedTokenAccountInstruction(
      SolWeb3Helper.signer.publicKey,
      solATA,
      SolWeb3Helper.signer.publicKey,
      SolWeb3Helper.getPubkey(SOL_MINT),
    ));
    if (!buySol) {
      txObject.add(SystemProgram.transfer({
        fromPubkey: SolWeb3Helper.signer.publicKey,
        toPubkey: solATA,
        lamports: amountIn,
      }));
    }
    txObject.add(
      createSyncNativeInstruction(
        solATA,
      ),
    );

    const tokenAta = await getAssociatedTokenAddress(
      SolWeb3Helper.getPubkey(tokenAddress),
      SolWeb3Helper.signer.publicKey,
    );

    const tokenAccountInfo = await this.connection.getAccountInfo(tokenAta);
    if (!tokenAccountInfo) {
      txObject.add(
        createAssociatedTokenAccountInstruction(
          SolWeb3Helper.signer.publicKey,
          tokenAta,
          SolWeb3Helper.signer.publicKey,
          SolWeb3Helper.getPubkey(tokenAddress),
        ),
      );
    }
    const { tokenAccountIn, tokenAccountOut } = buySol
      ? { tokenAccountIn: tokenAta, tokenAccountOut: solATA }
      : { tokenAccountIn: solATA, tokenAccountOut: tokenAta };
    const txn = Liquidity.makeSwapFixedInInstruction({
      connection: this.connection,
      poolKeys: pool,
      userKeys: {
        tokenAccountIn,
        tokenAccountOut,
        owner: SolWeb3Helper.signer.publicKey,
      },
      amountIn: amountIn,
      minAmountOut: '0',
    }, 4);
    for (let i = 0; i < txn.innerTransaction.instructions.length; i++) {
      txObject.add(txn.innerTransaction.instructions[i]);
    }

    txObject.add(
      createCloseAccountInstruction(
        solATA,
        SolWeb3Helper.signer.publicKey,
        SolWeb3Helper.signer.publicKey,
        [SolWeb3Helper.signer],
      ),
    );

    txObject.feePayer = SolWeb3Helper.signer.publicKey;
    return txObject;
  }

  findLogEntry(needle, logEntries) {
    for (let i = 0; i < logEntries.length; ++i) {
      if (logEntries[i].includes(needle)) {
        return logEntries[i];
      }
    }
    return null;
  }

  async fetchPoolKeysForLPInitTransactionHash(txSignature) {
    const tx = await this.connection.getParsedTransaction(txSignature, { maxSupportedTransactionVersion: 0 });
    if (!tx) {
      throw new Error(`Failed to fetch transaction with signature ${txSignature}`);
    }
    const poolInfo = this.parsePoolInfoFromLpTransaction(tx);
    const marketInfo = await this.fetchMarketInfo(poolInfo.marketId);
    const LiquidityPoolKeys = {
      poolId: poolInfo.id,
      baseMint: poolInfo.baseMint,
      quoteMint: poolInfo.quoteMint,
      lpMint: poolInfo.lpMint,
      baseDecimals: poolInfo.baseDecimals,
      quoteDecimals: poolInfo.quoteDecimals,
      lpDecimals: poolInfo.lpDecimals,
      version: 4,
      programId: poolInfo.programId,
      authority: poolInfo.authority,
      openOrders: poolInfo.openOrders,
      targetOrders: poolInfo.targetOrders,
      baseVault: poolInfo.baseVault,
      quoteVault: poolInfo.quoteVault,
      withdrawQueue: poolInfo.withdrawQueue,
      lpVault: poolInfo.lpVault,
      marketVersion: 3,
      marketProgramId: poolInfo.marketProgramId,
      marketId: poolInfo.marketId,
      marketAuthority: Market.getAssociatedAuthority({ programId: poolInfo.marketProgramId, marketId: poolInfo.marketId }).publicKey,
      marketBaseVault: marketInfo.baseVault,
      marketQuoteVault: marketInfo.quoteVault,
      marketBids: marketInfo.bids,
      marketAsks: marketInfo.asks,
      marketEventQueue: marketInfo.eventQueue,
      baseReserve: poolInfo.baseReserve,
      quoteReserve: poolInfo.quoteReserve,
      lpReserve: poolInfo.lpReserve,
      openTime: poolInfo.openTime,
    };

    return LiquidityPoolKeys;
  }

  async fetchMarketInfo(marketId) {
    const marketAccountInfo = await this.connection.getAccountInfo(marketId);
    if (!marketAccountInfo) {
      throw new Error(`Failed to fetch market info for market id ${marketId.toBase58()}`);
    }

    return MARKET_STATE_LAYOUT_V3.decode(marketAccountInfo.data);
  }

  parsePoolInfoFromLpTransaction(txData) {
    const initInstruction = this.findInstructionByProgramId(txData.transaction.message.instructions, new PublicKey(RAYDIUM_POOL_V4_PROGRAM_ID));
    if (!initInstruction) {
      throw new Error('Failed to find lp init instruction in lp init tx');
    }
    const baseMint = initInstruction.accounts[8];
    const baseVault = initInstruction.accounts[10];
    const quoteMint = initInstruction.accounts[9];
    const quoteVault = initInstruction.accounts[11];
    const lpMint = initInstruction.accounts[7];
    const baseAndQuoteSwapped = baseMint.toBase58() === SOL_MINT;

    const lpMintInitInstruction = this.findInitializeMintInInnerInstructionsByMintAddress(txData.meta?.innerInstructions ?? [], lpMint);
    if (!lpMintInitInstruction) {
      throw new Error('Failed to find lp mint init instruction in lp init tx');
    }
    const lpMintInstruction = this.findMintToInInnerInstructionsByMintAddress(txData.meta?.innerInstructions ?? [], lpMint);
    if (!lpMintInstruction) {
      throw new Error('Failed to find lp mint to instruction in lp init tx');
    }
    const baseTransferInstruction = this
      .findTransferInstructionInInnerInstructionsByDestination(txData.meta?.innerInstructions ?? [], baseVault, TOKEN_PROGRAM_ID);
    if (!baseTransferInstruction) {
      throw new Error('Failed to find base transfer instruction in lp init tx');
    }
    const quoteTransferInstruction = this
      .findTransferInstructionInInnerInstructionsByDestination(txData.meta?.innerInstructions ?? [], quoteVault, TOKEN_PROGRAM_ID);
    if (!quoteTransferInstruction) {
      throw new Error('Failed to find quote transfer instruction in lp init tx');
    }
    const lpDecimals = lpMintInitInstruction.parsed.info.decimals;
    const lpInitializationLogEntryInfo = this.extractLPInitializationLogEntryInfoFromLogEntry(
      this.findLogEntry('init_pc_amount', txData.meta?.logMessages ?? []) ?? '',
    );
    const basePreBalance = (txData.meta?.preTokenBalances ?? []).find((balance) => balance.mint === baseMint.toBase58());
    if (!basePreBalance) {
      throw new Error('Failed to find base tokens preTokenBalance entry to parse the base tokens decimals');
    }
    const baseDecimals = basePreBalance.uiTokenAmount.decimals;
    return {
      id: initInstruction.accounts[4],
      baseMint,
      quoteMint,
      lpMint,
      baseDecimals: baseAndQuoteSwapped ? SOL_DECIMALS : baseDecimals,
      quoteDecimals: baseAndQuoteSwapped ? baseDecimals : SOL_DECIMALS,
      lpDecimals,
      version: 4,
      programId: new PublicKey(RAYDIUM_POOL_V4_PROGRAM_ID),
      authority: initInstruction.accounts[5],
      openOrders: initInstruction.accounts[6],
      targetOrders: initInstruction.accounts[13],
      baseVault,
      quoteVault,
      withdrawQueue: new PublicKey('11111111111111111111111111111111'),
      lpVault: new PublicKey(lpMintInstruction.parsed.info.account),
      marketVersion: 3,
      marketProgramId: initInstruction.accounts[15],
      marketId: initInstruction.accounts[16],
      baseReserve: parseInt(baseTransferInstruction.parsed.info.amount, 10),
      quoteReserve: parseInt(quoteTransferInstruction.parsed.info.amount, 10),
      lpReserve: parseInt(lpMintInstruction.parsed.info.amount, 10),
      openTime: lpInitializationLogEntryInfo.open_time,
    };
  }

  findTransferInstructionInInnerInstructionsByDestination(innerInstructions, destinationAccount, programId) {
    for (let i = 0; i < innerInstructions.length; i++) {
      for (let y = 0; y < innerInstructions[i].instructions.length; y++) {
        const instruction = innerInstructions[i].instructions[y];
        if (!instruction.parsed) continue;
        if (
          instruction.parsed.type === 'transfer'
          && instruction.parsed.info.destination === destinationAccount.toBase58()
          && (!programId || instruction.programId.equals(programId))
        ) {
          return instruction;
        }
      }
    }

    return null;
  }

  findInitializeMintInInnerInstructionsByMintAddress(innerInstructions, mintAddress) {
    for (let i = 0; i < innerInstructions.length; i++) {
      for (let y = 0; y < innerInstructions[i].instructions.length; y++) {
        const instruction = innerInstructions[i].instructions[y];
        if (!instruction.parsed) continue;
        if (
          instruction.parsed.type === 'initializeMint'
          && instruction.parsed.info.mint === mintAddress.toBase58()
        ) {
          return instruction;
        }
      }
    }

    return null;
  }

  findMintToInInnerInstructionsByMintAddress(innerInstructions, mintAddress) {
    for (let i = 0; i < innerInstructions.length; i++) {
      for (let y = 0; y < innerInstructions[i].instructions.length; y++) {
        const instruction = innerInstructions[i].instructions[y];
        if (!instruction.parsed) continue;
        if (
          instruction.parsed.type === 'mintTo'
          && instruction.parsed.info.mint === mintAddress.toBase58()
        ) {
          return instruction;
        }
      }
    }

    return null;
  }

  findInstructionByProgramId(instructions, programId) {
    for (let i = 0; i < instructions.length; i++) {
      if (instructions[i].programId.equals(programId)) {
        return instructions[i];
      }
    }

    return null;
  }

  extractLPInitializationLogEntryInfoFromLogEntry(lpLogEntry) {
    const lpInitializationLogEntryInfoStart = lpLogEntry.indexOf('{');
    return JSON.parse(this.fixRelaxedJsonInLpLogEntry(lpLogEntry.substring(lpInitializationLogEntryInfoStart)));
  }

  fixRelaxedJsonInLpLogEntry(relaxedJson) {
    return relaxedJson.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  }

  async isPoolsLpBurned(tokenAccount, lpAmount) {
    const txns = await this.connection.getSignaturesForAddress(SolWeb3Helper.getPubkey(tokenAccount), {}, 'finalized');
    if (txns.length === 0) {
      throw new Error('No transactions');
    }
    const tx = await this.connection.getParsedTransaction(txns[0].signature, { maxSupportedTransactionVersion: 0 });
    if (!tx) {
      throw new Error(`Failed to fetch transaction with signature ${txns}`);
    }
    const isBurnTxn = this.findLogEntry('Burn', tx.meta.logMessages) || this.findLogEntry('BurnChecked', tx.meta.logMessages);
    const isTransferTxn = this.findLogEntry('Transfer', tx.meta.logMessages);

    if (isTransferTxn || !isBurnTxn) {
      return false;
    }
    const burnInstruction = tx.transaction.message.instructions.find((item) => item?.parsed?.type === 'burn')
    || tx.transaction.message.instructions.find((item) => item?.parsed?.type === 'burnChecked');
    if (!burnInstruction) {
      return false;
    }
    if (burnInstruction.parsed.info.amount !== lpAmount.toString()) {
      return false;
    }
    // logger.info(`Lp burn transaction found at: ${new Date()}`);
    return true;
  }
}

module.exports = new RaydiumNewPoolListener();
