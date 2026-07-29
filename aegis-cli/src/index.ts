#!/usr/bin/env node
import { Command } from "commander";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import * as crypto from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import "dotenv/config";
import { exportDockerImage, importDockerImage } from "./docker";
import { uploadToShelby, downloadFromShelby } from "./shelby";
import { publishImage, grantAccess, initRepository, getRegistryData } from "./aptos";

const program = new Command();
program
  .name("aegis")
  .description("Zero-Trust Decentralized Container CLI built on Shelby Protocol")
  .version("1.0.0");

function getSigner(): Account {
  const pk = process.env.APTOS_PRIVATE_KEY;
  if (!pk) {
    console.error("APTOS_PRIVATE_KEY is missing from .env");
    process.exit(1);
  }
  return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(pk) });
}

async function getMasterKey(): Promise<Buffer> {
  const keyPath = path.join(process.cwd(), "master_key.txt");
  try {
    const hex = await fs.readFile(keyPath, "utf-8");
    return Buffer.from(hex.trim(), "hex");
  } catch (e) {
    console.log("No master_key.txt found. Generating a new master AES key...");
    const newKey = crypto.randomBytes(32);
    await fs.writeFile(keyPath, newKey.toString("hex"));
    return newKey;
  }
}

program
  .command("init")
  .description("Initialize a new repository on Aptos")
  .action(async () => {
    try {
      console.log("Initializing repository on Aptos...");
      const txHash = await initRepository(getSigner());
      console.log(`Repository initialized successfully! Tx: ${txHash}`);
    } catch (e) {
      console.error("Failed to initialize repo:", e);
    }
  });

program
  .command("push")
  .description("Encrypts and pushes a Docker image to Shelby and updates Aptos registry")
  .argument("<tag>", "Docker image tag (e.g. my-app:latest)")
  .action(async (tag) => {
    try {
      const signer = getSigner();
      const aesKey = await getMasterKey();

      // 1. Export & Encrypt locally
      const { tempFile, digest } = await exportDockerImage(tag, aesKey);
      const fileStat = await fs.stat(tempFile);

      // 2. Upload to Shelby
      const blobId = `blob_${crypto.randomBytes(8).toString('hex')}`;
      await uploadToShelby(blobId, tempFile, signer.privateKey.toString());
      
      // Cleanup temp encrypted file
      await fs.unlink(tempFile);

      // 3. Update Aptos Registry
      console.log("Publishing metadata to Aptos...");
      const txHash = await publishImage(signer, tag, blobId, digest, fileStat.size);
      
      console.log(`\n🎉 Successfully pushed ${tag} to Shelby!`);
      console.log(`Blob ID: ${blobId}`);
      console.log(`Aptos Tx: ${txHash}`);
      
      const shelbyBlobUrl = `https://explorer.shelby.xyz/shelbynet/account/${process.env.APTOS_ADDRESS}/blobs`;
      const aptosTxUrl = `${process.env.APTOS_NODE_URL}/transactions/by_hash/${txHash}`;
      
      console.log(`View Blob on Shelby Explorer: ${shelbyBlobUrl}`);
      console.log(`View Smart Contract Tx (Raw API): ${aptosTxUrl}`);

    } catch (e) {
      console.error("Failed to push image:", e);
    }
  });

program
  .command("grant")
  .description("Grant access to a specific Aptos wallet address")
  .argument("<grantee>", "Aptos wallet address to grant access to")
  .action(async (grantee) => {
    try {
      const signer = getSigner();
      const aesKey = await getMasterKey();
      
      console.log(`Granting access to ${grantee}...`);
      const txHash = await grantAccess(signer, signer.accountAddress.toString(), grantee, aesKey.toString('hex'));
      
      console.log(`\n🎉 Access successfully granted!`);
      console.log(`Aptos Tx: ${txHash}`);
      console.log(`View Smart Contract Tx (Raw API): ${process.env.APTOS_NODE_URL}/transactions/by_hash/${txHash}`);
    } catch (e) {
      console.error("Failed to grant access:", e);
    }
  });

program
  .command("pull")
  .description("Pull and decrypt a Docker image from a repository owner")
  .argument("<repoOwner>", "Aptos wallet address of the repository owner")
  .argument("<tag>", "Docker image tag (e.g. alpine:latest)")
  .action(async (repoOwner, tag) => {
    try {
      const signer = getSigner();
      
      console.log(`Querying Aptos registry for ${repoOwner}...`);
      const data = await getRegistryData(repoOwner);
      if (!data) throw new Error("Repository not found!");

      // Find the tag metadata
      const imageEntry = data.images.data.find((item: any) => item.key === tag);
      if (!imageEntry) throw new Error(`Tag ${tag} not found in repository!`);
      const { blob_id, image_digest } = imageEntry.value;

      // Find the AES key
      const keyEntry = data.encrypted_keys.data.find((item: any) => item.key === signer.accountAddress.toString());
      if (!keyEntry) throw new Error("You do not have access to this repository!");
      
      // The key is returned as a hex string with '0x' prefix from Aptos
      let keyHex = keyEntry.value;
      if (keyHex.startsWith("0x")) keyHex = keyHex.slice(2);
      const aesKey = Buffer.from(keyHex, "hex");

      console.log(`Access verified. Downloading encrypted blob ${blob_id} from Shelby...`);
      const tempEncryptedFile = path.join(process.cwd(), `downloaded_${Date.now()}.bin`);
      
      await downloadFromShelby(repoOwner, blob_id, tempEncryptedFile);

      await importDockerImage(tempEncryptedFile, aesKey, image_digest);
      
      console.log(`\n🎉 Successfully pulled ${tag} from ${repoOwner}!`);
    } catch (e) {
      console.error("Failed to pull image:", e);
    }
  });

program.parse(process.argv);
