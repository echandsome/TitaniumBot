const web3 = require('@solana/web3.js');
const bs58 = require('bs58');
const splToken = require('@solana/spl-token');
const logger = require('log4js').getLogger('solana_web3_helper');
const { NO_OF_WALLETS_TO_HOLD_SUPPLY, MAX_PERCENTAGE_HOLDING_THRESHOLD } = require('./pool_filter_params');
const {
  RPC_URL, WSS_RPC_URL, RAYDIUM_AUTHORITY_V4, PRIVATE_KEY,
} = require('../../config/envs');

class SolWeb3Helper {
  constructor() {
    this.connection = new web3.Connection(RPC_URL, {
      wsEndpoint: WSS_RPC_URL,
    });
    const secretKey = bs58.decode(PRIVATE_KEY);
    // const secretKey = new Uint8Array(JSON.parse(PRIVATE_KEY));
    this.signer = web3.Keypair.fromSecretKey(secretKey);
    this.constantValues = {
      ZEROS: '0'.repeat(256),
    };
  }

  async sendTransactionToBlockchain(ix) {
    const txn = new web3.Transaction();
    txn.add(ix);
    const data = await web3.sendAndConfirmTransaction(this.connection, txn, this.signer);
    return data;
  }

  async sendAndConfirmTransactionOnBlockchain(txObject) {
    // const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    // txObject.recentBlockhash = blockhash;
    // txObject.lastValidBlockHeight = lastValidBlockHeight;
    const signature = await web3.sendAndConfirmTransaction(
      this.connection,
      txObject,
      [this.signer],
      { skipPreflight: true, preflightCommitment: 'confirmed' },
    );
    return signature;
  }

  async sendVersionedTransactionToBlockchain(
    instructions,
  ) {
    const { blockhash } = await this.connection.getLatestBlockhash();
    const messageV0 = new web3.TransactionMessage({
      payerKey: this.signer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new web3.VersionedTransaction(messageV0);
    tx.sign([this.signer]);

    const txnSignature = await this.connection.sendTransaction(tx);
    // logger.info(`Transaction signature: ${txnSignature}`);

    const latestBlockhash = await this.connection.getLatestBlockhash('finalized');
    await this.connection.confirmTransaction({
      signature: txnSignature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });
    // logger.info(`Transaction status confirmed: ${txnSignature}`);

    return txnSignature;
  }

  async isMintAuthorityRevoked(tokenAddressPubkey) {
    try {
      const mint = await splToken.getMint(this.connection, tokenAddressPubkey);
      if (!mint.mintAuthority) {
        return { status: true, totalSupply: mint.supply };
      }
      return { status: false, totalSupply: mint.supply };
    } catch (err) {
      logger.error(`Not an token mint account ${err}`);
      return { status: false, totalSupply: BigInt(0) };
    }
  }

  async isTopTokenHolderPercentageUnderThreshold(tokenAddressPubkey, totalSupply) {
    try {
      const topAccountsData = await this.connection.getTokenLargestAccounts(tokenAddressPubkey);
      const topAccounts = topAccountsData.value;
      const length = topAccounts.length > NO_OF_WALLETS_TO_HOLD_SUPPLY
        ? NO_OF_WALLETS_TO_HOLD_SUPPLY
        : topAccounts.length;
      const raydiumPubKey = new web3.PublicKey(RAYDIUM_AUTHORITY_V4);
      const raydiumTokenAccount = await this.connection.getTokenAccountsByOwner(raydiumPubKey, { mint: tokenAddressPubkey });
      const raydiumTokenAccounts = raydiumTokenAccount.value.reduce((accm, account) => {
        accm.push(account.pubkey.toBase58());
        return accm;
      }, []);

      let amountHoldByTopAccounts = BigInt(0);
      let noOfUser = 0;
      for (let itr = 0; noOfUser < length && itr < topAccounts.length; itr++) {
        if (raydiumTokenAccounts.includes(topAccounts[itr].address.toBase58())) {
          continue;
        }
        amountHoldByTopAccounts += BigInt(topAccounts[itr].amount);
        noOfUser++;
      }

      const amtHoldByTopAccountsPercentage = (amountHoldByTopAccounts * BigInt(100)) / totalSupply;
      if (amtHoldByTopAccountsPercentage < BigInt(MAX_PERCENTAGE_HOLDING_THRESHOLD)) {
        return true;
      }
      return false;
    } catch (err) {
      logger.error(`Not an token mint account ${err}`);
      return false;
    }
  }

  async getTokenBalanceByMintAddress(tokenMintAddress) {
    const tokenMintAddressPubkey = new web3.PublicKey(tokenMintAddress);
    const signerTokenAccount = await this.connection
      .getTokenAccountsByOwner(this.signer.publicKey, { mint: tokenMintAddressPubkey });
    const tokenAccount = signerTokenAccount.value[0]?.pubkey;
    if (!tokenAccount) {
      return null;
    }
    const balance = await this.connection.getTokenAccountBalance(tokenAccount);
    return balance.value;
  }

  getPubkey(address) {
    return new web3.PublicKey(address);
  }

  parseUnits(value, decimals) {
    // eslint-disable-next-line no-param-reassign
    if (decimals == null) { decimals = 0; }
    if (decimals < 1 || decimals > 257) {
      throw new Error('Invalid decimal value');
    }

    const multiplier = BigInt(`1${this.constantValues.ZEROS.substring(0, decimals)}`);
    if (typeof (value) !== 'string' || !value.match(/^-?[0-9.]+$/)) {
      throw new Error('invalid decimal value', 'value', value);
    }

    // Is it negative?
    const negative = (value.substring(0, 1) === '-');
    // eslint-disable-next-line no-param-reassign
    if (negative) { value = value.substring(1); }

    if (value === '.') {
      throw new Error('missing value');
    }

    // Split it into a whole and fractional part
    const comps = value.split('.');
    if (comps.length > 2) {
      throw new Error('too many decimal points');
    }

    let whole = comps[0];
    let fraction = comps[1];
    if (!whole) { whole = '0'; }
    if (!fraction) { fraction = '0'; }

    // Trim trailing zeros
    while (fraction[fraction.length - 1] === '0') {
      fraction = fraction.substring(0, fraction.length - 1);
    }

    // Check the fraction doesn't exceed our decimals size
    if (fraction.length > decimals) {
      throw new Error('fractional component exceeds decimals');
    }

    // If decimals is 0, we have an empty string for fraction
    if (fraction === '') { fraction = '0'; }

    // Fully pad the string with zeros to get to wei
    while (fraction.length < decimals) { fraction += '0'; }

    const wholeValue = BigInt(whole);
    const fractionValue = BigInt(fraction);
    let lamports = (wholeValue * multiplier) + fractionValue;
    if (negative) { lamports *= BigInt(-1); }

    return lamports;
  }
}

module.exports = new SolWeb3Helper();
