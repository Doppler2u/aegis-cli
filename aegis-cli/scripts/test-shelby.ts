import { uploadToShelby, downloadFromShelby } from "../src/shelby";
import * as fs from "fs";
import "dotenv/config";

async function runTest() {
  try {
    const address = process.env.APTOS_ADDRESS!;
    const privateKey = process.env.APTOS_PRIVATE_KEY!;
    
    // Create a dummy file
    const testFilePath = "test_upload.txt";
    fs.writeFileSync(testFilePath, "Hello Shelby Protocol! This is Aegis Phase 1 testing.");

    const blobName = `test_blob_${Date.now()}`;

    // Upload
    await uploadToShelby(blobName, testFilePath, privateKey);

    // Download
    const outPath = "test_download.txt";
    await downloadFromShelby(address, blobName, outPath);

    // Verify
    const downloadedContent = fs.readFileSync(outPath, "utf-8");
    if (downloadedContent === "Hello Shelby Protocol! This is Aegis Phase 1 testing.") {
      console.log("Phase 1 verification successful! File content matches perfectly.");
    } else {
      console.error("Phase 1 failed: File content mismatch.");
    }

  } catch (error) {
    console.error("Error during Phase 1 test:", error);
  }
}

runTest();
