import { Keypair, Horizon, TransactionBuilder, Operation, Asset, Memo, Networks } from '@stellar/stellar-sdk';

async function testSubmit() {
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  const payer = Keypair.random();
  const payee = Keypair.random();

  console.log('Payer:', payer.publicKey());
  console.log('Payee:', payee.publicKey());

  console.log('Funding payer with Friendbot...');
  const res1 = await fetch(`https://friendbot.stellar.org?addr=${payer.publicKey()}`);
  console.log('Friendbot payer status:', res1.status);

  console.log('Funding payee with Friendbot...');
  const res2 = await fetch(`https://friendbot.stellar.org?addr=${payee.publicKey()}`);
  console.log('Friendbot payee status:', res2.status);

  console.log('Loading payer account...');
  const account = await server.loadAccount(payer.publicKey());
  console.log('Payer account loaded. Sequence:', account.sequence);

  const memo = Memo.text('POLLAR_OFFLINE_TX');

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(
      Operation.payment({
        destination: payee.publicKey(),
        asset: Asset.native(),
        amount: '1.0000000'
      })
    )
    .addMemo(memo)
    .setTimeout(30)
    .build();

  tx.sign(payer);

  console.log('Submitting transaction to Horizon Testnet...');
  const result = await server.submitTransaction(tx);
  console.log('Transaction SUCCESS! Hash:', result.hash);
  console.log('Stellar Expert URL: https://stellar.expert/explorer/testnet/tx/' + result.hash);
}

testSubmit().catch(console.error);
