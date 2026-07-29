import { Account, Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import "dotenv/config";

const APTOS_NODE_URL = process.env.APTOS_NODE_URL || "https://api.shelbynet.shelby.xyz/v1";

const aptosConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: APTOS_NODE_URL
});
export const aptos = new Aptos(aptosConfig);

export const MODULE_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.APTOS_ADDRESS;
export const MODULE_NAME = "registry";

export async function initRepository(signer: Account) {
  const transaction = await aptos.transaction.build.simple({
    sender: signer.accountAddress,
    data: {
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::init_repository`,
      functionArguments: [],
    },
  });
  
  const pendingTx = await aptos.signAndSubmitTransaction({ signer, transaction });
  await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
  return pendingTx.hash;
}

export async function grantAccess(
  signer: Account, 
  repoOwner: string, 
  grantee: string, 
  encryptedKeyHex: string
) {
  const encryptedKeyBytes = Buffer.from(encryptedKeyHex, 'hex');

  const transaction = await aptos.transaction.build.simple({
    sender: signer.accountAddress,
    data: {
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::grant_access`,
      functionArguments: [repoOwner, grantee, encryptedKeyBytes],
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({ signer, transaction });
  await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
  return pendingTx.hash;
}

export async function publishImage(
  signer: Account,
  tag: string,
  blobId: string,
  imageDigest: string,
  size: number
) {
  const transaction = await aptos.transaction.build.simple({
    sender: signer.accountAddress,
    data: {
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::publish_image`,
      functionArguments: [tag, blobId, imageDigest, size],
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({ signer, transaction });
  await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
  return pendingTx.hash;
}

export async function getRegistryData(repoOwner: string) {
  const resourceType = `${MODULE_ADDRESS}::${MODULE_NAME}::Repository`;
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: repoOwner,
      resourceType,
    });
    return resource as any;
  } catch (e) {
    console.error("Error fetching registry data:", e);
    return null;
  }
}
