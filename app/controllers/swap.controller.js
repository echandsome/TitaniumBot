const apiRes = await rayPools({
    baseMint: inputToken?.data?.address,
    quoteMint: outputToken?.data?.address,
  }).unwrap();

  console.log(apiRes, "apires");

  const poolAddress = JSON.parse(apiRes?.data?.rawData);
  console.log(poolAddress, "pooladdreees ray api");
  const Adecimal =
    poolAddress?.baseMint === inputToken?.data?.address
      ? poolAddress?.baseDecimals
      : poolAddress?.quoteDecimals;
  const Amint =
    poolAddress?.baseMint === inputToken?.data?.address
      ? poolAddress?.baseMint
      : poolAddress?.quoteMint;
  const inputTokenn = new Token(
    TOKEN_PROGRAM_ID,
    new PublicKey(Amint),
    Adecimal
  );
  const targetPool = poolAddress?.id;
  const inputTokenAmount = new TokenAmount(
    inputTokenn,
    Number(inputVal)  10 * Adecimal
  );
  const slipage = new Percent(slippage * 10, 100);

  const walletTokenAccounts = await getWalletTokenAccount(
    connection,
    publicKey
  );
  const Bdecimal =
    poolAddress?.quoteMint === outputToken?.data?.address
      ? poolAddress?.quoteDecimals
      : poolAddress?.baseDecimals;
  const Bmint =
    poolAddress?.quoteMint === outputToken?.data?.address
      ? poolAddress?.quoteMint
      : poolAddress?.baseMint;

  const txs = await swapOnlyAmm({
    outputToken: new Token(
      TOKEN_PROGRAM_ID,
      new PublicKey(Bmint),
      Bdecimal
    ),
    targetPool,
    inputTokenAmount,
    slipage,
    walletTokenAccounts,
    wallet: publicKey,
    ammPool: poolAddress,
  }).then(({ txids }) => {
    return txids;
  });

  const tx = new Transaction();
  const feeInstruction = await handleTransaction();
  tx.add(feeInstruction);
  tx.add(txs[0]);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  tx.feePayer = publicKey;
  tx.recentBlockhash = blockhash;
  const transactionSign = await signTransaction(tx);

  const signature = await connection.sendRawTransaction(
    transactionSign.serialize()
  );

  window.open(
    `https://solscan.io/tx/${signature}`,
    "_blank",
    "toolbar=0,location=0,menubar=0"
  );



async function swapOnlyAmm(input) {
const ENDPOINT = "https://api.raydium.io";
const RAYDIUM_MAINNET_API = {
poolInfo: "/v2/sdk/liquidity/mainnet.json",
};
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
},27/12

amountIn: input.inputTokenAmount,
amountOut: minAmountOut,
fixedSide: "in",
makeTxVersion: TxVersion.V0,
});

return { txids: innerTransactions };
}  