import * as crypto from "crypto";
import { Transform, TransformCallback } from "stream";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Generates a strong random AES-256 key.
 */
export function generateKey(): Buffer {
  return crypto.randomBytes(32);
}

/**
 * EncryptTransform
 * Streams data through AES-256-GCM.
 * It prepends the 12-byte IV to the stream.
 * It appends the 16-byte Auth Tag to the end of the stream.
 */
export class EncryptTransform extends Transform {
  private cipher: crypto.CipherGCM;
  private iv: Buffer;
  private ivSent = false;

  constructor(key: Buffer) {
    super();
    this.iv = crypto.randomBytes(IV_LENGTH);
    this.cipher = crypto.createCipheriv(ALGORITHM, key, this.iv);
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
    if (!this.ivSent) {
      this.push(this.iv);
      this.ivSent = true;
    }
    const encryptedChunk = this.cipher.update(chunk);
    if (encryptedChunk.length > 0) {
      this.push(encryptedChunk);
    }
    callback();
  }

  _flush(callback: TransformCallback) {
    try {
      this.cipher.final(); // for GCM, final() returns empty buffer but must be called
      const tag = this.cipher.getAuthTag();
      this.push(tag);
      callback();
    } catch (err: any) {
      callback(err);
    }
  }
}

/**
 * DecryptTransform
 * Streams data through AES-256-GCM decryption.
 * Extracts the 12-byte IV from the beginning.
 * Buffers the stream to hold back the last 16-byte Auth Tag.
 * Applies the Auth Tag before finalizing the decipher.
 */
export class DecryptTransform extends Transform {
  private key: Buffer;
  private decipher: crypto.DecipherGCM | null = null;
  private iv: Buffer = Buffer.alloc(0);
  private tailBuffer: Buffer = Buffer.alloc(0);

  constructor(key: Buffer) {
    super();
    this.key = key;
  }

  _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
    try {
      // 1. Accumulate chunk into the tailBuffer
      this.tailBuffer = Buffer.concat([this.tailBuffer, chunk]);

      // 2. Extract IV if we haven't yet and have enough bytes
      if (!this.decipher) {
        if (this.tailBuffer.length >= IV_LENGTH) {
          this.iv = this.tailBuffer.subarray(0, IV_LENGTH);
          this.decipher = crypto.createDecipheriv(ALGORITHM, this.key, this.iv);
          this.tailBuffer = this.tailBuffer.subarray(IV_LENGTH);
        } else {
          // Wait for more bytes to get the IV
          return callback();
        }
      }

      // 3. Keep 16 bytes for the auth tag, process the rest
      if (this.tailBuffer.length > TAG_LENGTH) {
        const processLength = this.tailBuffer.length - TAG_LENGTH;
        const processBuffer = this.tailBuffer.subarray(0, processLength);
        this.tailBuffer = this.tailBuffer.subarray(processLength);

        const decryptedChunk = this.decipher.update(processBuffer);
        if (decryptedChunk.length > 0) {
          this.push(decryptedChunk);
        }
      }

      callback();
    } catch (err: any) {
      callback(err);
    }
  }

  _flush(callback: TransformCallback) {
    try {
      if (!this.decipher) {
        throw new Error("Stream ended before IV could be read");
      }
      if (this.tailBuffer.length !== TAG_LENGTH) {
        throw new Error("Stream ended without sufficient Auth Tag data");
      }

      const tag = this.tailBuffer;
      this.decipher.setAuthTag(tag);
      
      const finalChunk = this.decipher.final();
      if (finalChunk.length > 0) {
        this.push(finalChunk);
      }
      
      callback();
    } catch (err: any) {
      // If tag verification fails, this will throw an error
      callback(new Error("Decryption failed: " + err.message));
    }
  }
}
