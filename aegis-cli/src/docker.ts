import { spawn } from "child_process";
import { createWriteStream, createReadStream, promises as fs } from "fs";
import { pipeline } from "stream/promises";
import * as crypto from "crypto";
import { EncryptTransform, DecryptTransform, generateKey } from "./crypto";
import * as path from "path";

/**
 * Executes `docker save` and pipes its output through the EncryptTransform.
 * Simultaneously calculates the SHA-256 digest of the unencrypted stream.
 * Saves the encrypted output to a temporary file.
 * Returns the AES key used, the path to the temp encrypted file, and the SHA-256 digest.
 */
export async function exportDockerImage(tag: string, aesKey: Buffer): Promise<{ 
  tempFile: string, 
  aesKey: Buffer, 
  digest: string 
}> {
  console.log(`Exporting and encrypting Docker image: ${tag}`);
  
  const tempFile = path.join(process.cwd(), `encrypted_${Date.now()}.bin`);
  const encryptor = new EncryptTransform(aesKey);
  
  const dockerProcess = spawn("docker", ["save", tag]);
  
  const hash = crypto.createHash('sha256');
  
  // Create a stream that duplicates the data into the hasher
  dockerProcess.stdout.on('data', (chunk) => {
    hash.update(chunk);
  });

  const outStream = createWriteStream(tempFile);
  
  await pipeline(
    dockerProcess.stdout,
    encryptor,
    outStream
  );

  const digest = hash.digest("hex");
  return { tempFile, aesKey, digest };
}

/**
 * Reads an encrypted temporary file, pipes it through DecryptTransform,
 * saves the decrypted output to another temp file, verifies its SHA-256 digest,
 * and if valid, pipes it into `docker load`.
 */
export async function importDockerImage(
  tempEncryptedFile: string, 
  aesKey: Buffer, 
  expectedDigest: string
): Promise<void> {
  console.log(`Decrypting and verifying Docker image...`);
  
  const tempDecryptedFile = path.join(process.cwd(), `decrypted_${Date.now()}.tar`);
  const decryptor = new DecryptTransform(aesKey);
  
  // 1. Decrypt into a temporary file
  await pipeline(
    createReadStream(tempEncryptedFile),
    decryptor,
    createWriteStream(tempDecryptedFile)
  );

  // 2. Verify SHA-256 Digest
  console.log(`Computing SHA-256 of decrypted data...`);
  const hash = crypto.createHash('sha256');
  const readStream = createReadStream(tempDecryptedFile);
  
  for await (const chunk of readStream) {
    hash.update(chunk);
  }
  const actualDigest = hash.digest("hex");

  if (actualDigest !== expectedDigest) {
    // Delete the corrupted file
    await fs.unlink(tempDecryptedFile);
    throw new Error(`Integrity check failed! Expected ${expectedDigest}, got ${actualDigest}`);
  }

  console.log(`Integrity verified! Loading into Docker...`);
  
  // 3. Load into Docker
  const dockerProcess = spawn("docker", ["load"]);
  
  await pipeline(
    createReadStream(tempDecryptedFile),
    dockerProcess.stdin
  );

  await new Promise<void>((resolve, reject) => {
    dockerProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Docker load failed with exit code ${code}`));
    });
  });

  // Cleanup
  await fs.unlink(tempDecryptedFile);
  console.log(`Docker image successfully loaded and cleaned up.`);
}
