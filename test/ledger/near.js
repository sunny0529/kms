const BN = require("bn.js");
const TransportNodeHid = require("@ledgerhq/hw-transport-node-hid").default;
const { transactions, providers, utils } = require("near-api-js");
const { KMS, CHAIN } = require("../../lib");
const { getAccount } = require("./_getAccount");
const near = require("../../lib/blockchains/near/ledger");

const TYPE = CHAIN.NEAR;
const INDEX = 1;

const TRANSFER = 0;
const DEPOSITANDSTAKE = 1;

function createInstruction(ix) {
  if (typeof ix.transactionType !== "number") {
    throw new Error("Instruction has no transaction type");
  }
  switch (ix.transactionType) {
    case 0: {
      // transfer
      const amount = utils.format.parseNearAmount(ix.amount);
      if (!amount) {
        throw new Error("Type 'null' is not assignable to amount");
      }
      return transactions.transfer(new BN(amount));
    }
    case 1: {
      // deposit_and_stake
      if (!ix.amount) {
        throw new Error("Amount is required");
      }
      if (!ix.gas) {
        throw new Error("Gas is required");
      }
      const amount = utils.format.parseNearAmount(ix.amount);
      if (!amount) {
        throw new Error("Type 'null' is not assignable to amount");
      }
      const { gas } = ix;
      return transactions.functionCall(
        "deposit_and_stake",
        new Uint8Array(),
        new BN(gas),
        new BN(amount)
      );
    }
    default:
      break;
  }
  throw new Error("Create instruction error");
}

function createTransaction(rawTx) {
  try {
    const { signerId } = rawTx;
    const { receiverId } = rawTx;
    const { nonce } = rawTx;
    const { recentBlockHash } = rawTx;
    const publicKey = utils.PublicKey.fromString(rawTx.encodedPubKey);
    const actions = [];
    for (let i = 0; i < rawTx.ixs.length; i += 1) {
      const action = near.LEDGER.createInstruction(rawTx.ixs[i]);
      actions.push(action);
      if (actions == null) {
        throw new Error("No actions provided");
      }
    }
    const transaction = transactions.createTransaction(
      signerId,
      publicKey,
      receiverId,
      nonce,
      actions,
      recentBlockHash
    );
    return transaction;
  } catch (error) {
    throw new Error(error);
  }
}

async function sendTransaction(response) {
  const rpc = "https://rpc.testnet.near.org";
  const provider = new providers.JsonRpcProvider(rpc);
  const signedSerializedTx = response.signedTx.encode();
  const result = await provider.sendJsonRpc("broadcast_tx_commit", [
    Buffer.from(signedSerializedTx).toString("base64"),
  ]);
  return result;
}

async function signTx(transport, type, index, account) {
  const kms = new KMS({
    keyStore: null,
    transport,
  });
  try {
    const encodedPubKey = account;
    const helperURL = `https://helper.testnet.near.org/publicKey/${account}/accounts`;
    // eslint-disable-next-line no-undef
    const accountIds = await fetch(helperURL).then((res) => res.json());
    const signerId = accountIds[Object.keys(accountIds).length - 1];
    const receiverId = "masternode24.pool.f863973.m0";
    const rpc = "https://rpc.testnet.near.org";
    const provider = new providers.JsonRpcProvider(rpc);
    const accessKey = await provider.query(
      `access_key/${signerId}/${account}`,
      ""
    );
    const nonce = accessKey.nonce + 1;
    const recentBlockHash = utils.serialize.base_decode(accessKey.block_hash);
    const response = await kms.signTx(
      {
        type,
        account: 0,
        index,
      },
      {
        provider,
        recentBlockHash,
        nonce,
        signerId,
        receiverId,
        encodedPubKey,
        ixs: [
          {
            amount: "1.4",
            transactionType: TRANSFER,
          },
          {
            amount: "2.9",
            gas: "300000000000000",
            transactionType: DEPOSITANDSTAKE,
          },
        ],
      }
    );
    // eslint-disable-next-line no-console
    console.log("response - ", response.signedTx);

    // SEND TRANSACTION
    const txResponse = await sendTransaction(response);
    // eslint-disable-next-line no-console
    console.log("Transaction sent - ", txResponse.transaction);
    //
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
  }
}

async function run() {
  const transport = await TransportNodeHid.create(1000);
  const account = await getAccount(transport, TYPE, INDEX);
  await signTx(transport, TYPE, INDEX, account);
  transport.close();
}

run();
