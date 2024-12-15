const raydiumPool = require('../model/raydiumPool');
const { addJobForNewPool } = require('../../job_queue/add_task');
const {fetchPoolKeysForLPInitTransactionHash,findLogEntry } = require ('../../job_queue/utils/app')
const axios = require('axios');
// const {Connection, PublicKey } = require('@solana/web3.js')
const { LiquidityPoolKeysV4, Token, TokenAmount, TOKEN_PROGRAM_ID ,getWalletTokenAccount} = require("@raydium-io/raydium-sdk");
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_ENDPOINT = 'https://mainnet.helius-rpc.com/?api-key=0374867c-5da7-42b6-a396-88ca0987eac5';
const RAYDIUM_POOL_V4_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const SERUM_OPENBOOK_PROGRAM_ID = 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SOL_DECIMALS = 9;

const connection = new Connection(RPC_ENDPOINT);
const seenTransactions = []  

class RaydiumPool {
  async createRaydiumPoolList(req, res) {
    try {
        connection.onLogs(new PublicKey(RAYDIUM_POOL_V4_PROGRAM_ID), async (txLogs) => {
            if (seenTransactions.includes(txLogs.signature)) {
                return;
            }
            seenTransactions.push(txLogs.signature);
            if (!findLogEntry('init_pc_amount', txLogs.logs)) {
                return;
            }
            const poolKeys = await fetchPoolKeysForLPInitTransactionHash(txLogs.signature);
            console.log("1111111111111111111111",poolKeys);
            try {
              const extractedPublicKeys = Object.keys(poolKeys).reduce((result, key) => {
                  if (poolKeys[key] instanceof PublicKey) {
                      result[key] = poolKeys[key].toBase58();
                  }
                  return result;
              }, {});
              // console.log("33333333333333333333",extractedPublicKeys);
          
              const poolRecord = {
                  poolId: extractedPublicKeys.id,
                  baseMint: extractedPublicKeys.baseMint,
                  quoteMint: extractedPublicKeys.quoteMint,
                  rawData: JSON.stringify(extractedPublicKeys),
                  baseVault: extractedPublicKeys.baseVault,
                  quoteVault: extractedPublicKeys.quoteVault 
              };
            await raydiumPool.create(poolRecord);
      
              const Adecimal = poolKeys.baseDecimals;
              const Amint = SOL_MINT;
              const inputTokenn = new Token(
                  TOKEN_PROGRAM_ID,
                  new PublicKey(Amint),
                  Adecimal
              );
              const targetPool = extractedPublicKeys.id;
              const inputTokenAmount = new TokenAmount(
                  inputTokenn,
                  Number(1) * 10 ** Adecimal
              );
              const slipage = new Percent(1 * 10, 100);
      
              const walletTokenAccounts = await getWalletTokenAccount(
                  connection,
                  "0xb82f94B083Be274Bd42F8d3d870Ad3283c2E2904"
              );
              const Bdecimal = poolKeys.quoteDecimals;
              const Bmint = extractedPublicKeys.quoteMint;
      
              // Check if the output token (Bmint) is not SOL before proceeding
              if (Bmint !== SOL_MINT) {
              const txs = await swapOnlyAmm({
                  outputToken: new Token(
                  RAYDIUM_POOL_V4_PROGRAM_ID,
                  new PublicKey(Bmint),
                  Bdecimal
                  ),
                  targetPool,
                  inputTokenAmount,
                  slipage,
                  walletTokenAccounts,
                  wallet: "0xb82f94B083Be274Bd42F8d3d870Ad3283c2E2904",
                  ammPool: extractedPublicKeys,
              }).then(({ txids }) => {
                  return txids;
              });
              async function swapOnlyAmm(input) {
                  const targetPoolInfo = input.ammPool;
                  const amount = input?.inputTokenAmount;
                  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo);
                  
                  const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
                  poolKeys: poolKeys,
                  poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
                  amountIn: input.inputTokenAmount,
                  currencyOut: input.outputToken,
                  slippage: input.slipage,
                  });
                  console.log(minAmountOut, "minoutray");
                  
                  // -------- step 2: create instructions by SDK function --------
                  const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                  connection,
                  poolKeys,
                  userKeys: {
                    tokenAccounts: input.walletTokenAccounts,
                    owner: input.wallet,
                  },  
                  amountIn: input.inputTokenAmount,
                  amountOut: minAmountOut,
                  fixedSide: "in",
                  makeTxVersion: TxVersion.V0,
                  });
                  
                  return { txids: innerTransactions };
                  }  
                  // const txid = await sendTransaction(transaction, connection, { signers, skipPreflight: true });
      
             }
      
             
           
          } catch (error) {
              console.error("Error inserting pool record into the database:", error.message);
              // Handle the error as needed
          }
            
            
        });
        console.log('Listening to new pools...');
     
  
      res.status(200).json({ message: 'Raydium Pools created successfully.' });
    } catch (error) {
      console.error('Error creating Raydium Pools:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
  


module.exports = RaydiumPool;





