import { generateKey, EncryptTransform, DecryptTransform } from "../src/crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import * as crypto from "crypto";

async function runTests() {
  console.log("--- Starting Phase 2 Crypto Tests ---\n");

  const key = generateKey();
  const testData = Buffer.from("Highly classified enterprise Docker image payload", "utf-8");

  // TEST 1: Successful Roundtrip
  console.log("Test 1: Normal encryption -> decryption roundtrip");
  try {
    const encryptor = new EncryptTransform(key);
    const decryptor = new DecryptTransform(key);

    const inputStream = Readable.from([testData]);
    
    // We will collect the decrypted output
    const decryptedChunks: Buffer[] = [];
    const outputStream = new TransformStreamAdapter(decryptedChunks);

    await pipeline(inputStream, encryptor, decryptor, outputStream);
    
    const outputData = Buffer.concat(decryptedChunks);
    if (outputData.equals(testData)) {
      console.log("? Test 1 Passed: Data decrypted perfectly.\n");
    } else {
      console.error("? Test 1 Failed: Decrypted data mismatch.");
      process.exit(1);
    }
  } catch (error) {
    console.error("? Test 1 Failed with error:", error);
    process.exit(1);
  }

  // TEST 2: Tampering Test (Auth Tag Validation)
  console.log("Test 2: Tampering with ciphertext to trigger MAC failure");
  try {
    // 1. Encrypt the data to a buffer
    const encryptor = new EncryptTransform(key);
    const inputStream = Readable.from([testData]);
    const encryptedChunks: Buffer[] = [];
    await pipeline(inputStream, encryptor, new TransformStreamAdapter(encryptedChunks));
    const encryptedData = Buffer.concat(encryptedChunks);

    // 2. Tamper with the ciphertext (flip a byte)
    // We flip the 15th byte (skipping the 12-byte IV)
    encryptedData[15] = encryptedData[15] ^ 1;

    // 3. Try to decrypt the tampered data
    const decryptor = new DecryptTransform(key);
    const tamperedStream = Readable.from([encryptedData]);
    
    await pipeline(tamperedStream, decryptor, new TransformStreamAdapter([]));

    console.error("? Test 2 Failed: Decryption succeeded on tampered data! (This is a huge security flaw)");
    process.exit(1);
  } catch (error: any) {
    if (error.message.includes("Unsupported state or unable to authenticate data") || error.message.includes("Decryption failed")) {
      console.log("? Test 2 Passed: Tampering successfully detected! (MAC verification failed)\n");
    } else {
      console.error("? Test 2 Failed with unexpected error:", error);
      process.exit(1);
    }
  }

  console.log("--- All Phase 2 Tests Passed! ---");
}

// Simple writable stream to collect chunks for testing
import { Writable } from "stream";
class TransformStreamAdapter extends Writable {
  constructor(private chunks: Buffer[]) {
    super();
  }
  _write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
    this.chunks.push(chunk);
    callback();
  }
}

runTests();
