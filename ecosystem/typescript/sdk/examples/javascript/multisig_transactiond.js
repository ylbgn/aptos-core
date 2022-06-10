/* eslint-disable no-console */
const aptos = require('aptos');

const { AptosClient, AptosAccount, FaucetClient, BCS, TxnBuilderTypes, TransactionBuilderMultiEd25519 } = aptos;

const NODE_URL = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com';
const FAUCET_URL = process.env.APTOS_FAUCET_URL || 'https://faucet.devnet.aptoslabs.com';

(async () => {
  const client = new AptosClient(NODE_URL);
  const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL, null);

  const account1 = new AptosAccount();
  const account2 = new AptosAccount();
  const account3 = new AptosAccount();
  const multiSigPublicKey = new TxnBuilderTypes.MultiEd25519PublicKey(
    [
      new TxnBuilderTypes.Ed25519PublicKey(account1.signingKey.publicKey),
      new TxnBuilderTypes.Ed25519PublicKey(account2.signingKey.publicKey),
      new TxnBuilderTypes.Ed25519PublicKey(account3.signingKey.publicKey),
    ],
    2,
  );

  const authKey = TxnBuilderTypes.AuthenticationKey.fromMultiEd25519PublicKey(multiSigPublicKey);

  const mutisigAccountAddress = authKey.derivedAddress();
  await faucetClient.fundAccount(mutisigAccountAddress, 5000);

  let resources = await client.getAccountResources(mutisigAccountAddress);
  let accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
  console.log(`multisig account coins: ${accountResource.data.coin.value}. Should be 5000!`);

  const account4 = new AptosAccount();
  await faucetClient.fundAccount(account4.address(), 0);
  resources = await client.getAccountResources(account4.address());
  accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
  console.log(`multisig account coins: ${accountResource.data.coin.value}. Should be 0!`);

  const token = new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString('0x1::TestCoin::TestCoin'));

  const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadScriptFunction(
    TxnBuilderTypes.ScriptFunction.natual(
      '0x1::Coin',
      'transfer',
      [token],
      [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(account4.address())), BCS.bcsSerializeUint64(123)],
    ),
  );

  const [{ sequence_number: sequnceNumber }, chainId] = await Promise.all([
    client.getAccount(mutisigAccountAddress),
    client.getChainId(),
  ]);

  const rawTxn = new TxnBuilderTypes.RawTransaction(
    TxnBuilderTypes.AccountAddress.fromHex(mutisigAccountAddress),
    BigInt(sequnceNumber),
    scriptFunctionPayload,
    1000n,
    1n,
    BigInt(Math.floor(Date.now() / 1000) + 10),
    new TxnBuilderTypes.ChainId(chainId),
  );

  const txnBuilder = new TransactionBuilderMultiEd25519((signingMessage) => {
    const sigHexStr1 = account1.signBuffer(signingMessage);
    const sigHexStr3 = account3.signBuffer(signingMessage);
    const bitmap = TxnBuilderTypes.MultiEd25519Signature.createBitmap([0, 2]);

    const muliEd25519Sig = new TxnBuilderTypes.MultiEd25519Signature(
      [
        new TxnBuilderTypes.Ed25519Signature(sigHexStr1.toUint8Array()),
        new TxnBuilderTypes.Ed25519Signature(sigHexStr3.toUint8Array()),
      ],
      bitmap,
    );

    return muliEd25519Sig;
  }, multiSigPublicKey);

  const bcsTxn = txnBuilder.sign(rawTxn);
  const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);

  await client.waitForTransaction(transactionRes.hash);

  resources = await client.getAccountResources(account4.address());
  accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
  console.log(`multisig account coins: ${accountResource.data.coin.value}. Should be 123!`);
})();
