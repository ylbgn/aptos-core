const aptos = require('aptos');

const NODE_URL = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com';
const FAUCET_URL = process.env.APTOS_FAUCET_URL || 'https://faucet.devnet.aptoslabs.com';

const { AptosClient, AptosAccount, FaucetClient, BCS, TxnBuilderTypes } = aptos;

const {
  AccountAddress,
  TypeTagStruct,
  ScriptFunction,
  StructTag,
  TransactionPayloadScriptFunction,
  RawTransaction,
  ChainId,
} = TxnBuilderTypes;

(async () => {
  const client = new AptosClient(NODE_URL);
  const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL, null);

  const account1 = new AptosAccount();
  await faucetClient.fundAccount(account1.address(), 5000);
  let resources = await client.getAccountResources(account1.address());
  let accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
  console.log(`account2 coins: ${accountResource.data.coin.value}. Should be 5000!`);

  const account2 = new AptosAccount();
  await faucetClient.fundAccount(account2.address(), 0);
  resources = await client.getAccountResources(account2.address());
  accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
  console.log(`account2 coins: ${accountResource.data.coin.value}. Should be 0!`);

  const token = new TypeTagStruct(StructTag.fromString('0x1::TestCoin::TestCoin'));

  const scriptFunctionPayload = new TransactionPayloadScriptFunction(
    ScriptFunction.natual(
      '0x1::Coin',
      'transfer',
      [token],
      [BCS.bcsToBytes(AccountAddress.fromHex(account2.address())), BCS.bcsSerializeUint64(717)],
    ),
  );

  const [{ sequence_number: sequnceNumber }, chainId] = await Promise.all([
    client.getAccount(account1.address()),
    client.getChainId(),
  ]);

  const rawTxn = new RawTransaction(
    AccountAddress.fromHex(account1.address()),
    BigInt(sequnceNumber),
    scriptFunctionPayload,
    1000n,
    1n,
    BigInt(Math.floor(Date.now() / 1000) + 10),
    new ChainId(chainId),
  );

  const bcsTxn = AptosClient.generateBCSTransaction(account1, rawTxn);
  const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);

  await client.waitForTransaction(transactionRes.hash);

  resources = await client.getAccountResources(account2.address());
  accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
  console.log(`account2 coins: ${accountResource.data.coin.value}. Should be 717!`);
})();
