import { Account, Ed25519PrivateKey, Network, AccountAddress } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import "dotenv/config";
import { readFileSync, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// Ensure environment variables are loaded
const apiKey = process.env.SHELBY_API_KEY || undefined;

const client = new ShelbyNodeClient({
  network: Network.SHELBYNET,
  apiKey: apiKey,
});

export async function uploadToShelby(
  blobName: string, 
  filePath: string, 
  privateKeyHex: string
) {
  const signer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKeyHex),
  });

  const duration = 24 * 60 * 60 * 1_000_000; // 1 day

  console.log(`Uploading ${blobName} to Shelby...`);
  
  // Note: For MVP, we load the whole file into memory. 
  // In a production scenario with massive images, we may need 
  // advanced chunking if the SDK does not natively stream.
  const blobData = readFileSync(filePath);

  await client.upload({
    blobData,
    signer,
    blobName,
    expirationMicros: Date.now() * 1000 + duration,
  });

  console.log(`Successfully uploaded ${blobName}`);
}

export async function downloadFromShelby(
  accountAddress: string,
  blobName: string,
  outPath: string
) {
  console.log(`Downloading ${blobName} from Shelby...`);
  
  const account = AccountAddress.fromString(accountAddress);
  const blob = await client.download({ account, blobName });

  const webStream = blob.readable as unknown as ReadableStream;
  await pipeline(Readable.fromWeb(webStream as any), createWriteStream(outPath));

  console.log(`Successfully downloaded ${blobName} to ${outPath}`);
}
