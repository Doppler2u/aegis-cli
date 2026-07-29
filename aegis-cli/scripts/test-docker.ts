import { exportDockerImage, importDockerImage } from "../src/docker";
import { execSync } from "child_process";
import { promises as fs } from "fs";

async function testDockerIntegration() {
  console.log("--- Starting Phase 3 Docker Tests ---\n");

  const testImage = "alpine:latest";

  try {
    // 1. Ensure alpine is present
    console.log(`Pulling ${testImage} for testing...`);
    execSync(`docker pull ${testImage}`, { stdio: "inherit" });
    console.log("");

    // 2. Export and Encrypt
    const { tempFile, aesKey, digest } = await exportDockerImage(testImage);
    console.log(`\nExport complete!`);
    console.log(`Encrypted Temp File: ${tempFile}`);
    console.log(`Original SHA-256 Digest: ${digest}`);

    // 3. Delete the image locally so we can prove it was re-loaded
    console.log(`\nRemoving local docker image...`);
    execSync(`docker rmi ${testImage}`, { stdio: "inherit" });

    // 4. Import and Decrypt
    console.log(`\nImporting...`);
    await importDockerImage(tempFile, aesKey, digest);
    
    // 5. Verify it's back
    console.log(`\nVerifying image was loaded...`);
    const images = execSync(`docker images -q ${testImage}`).toString();
    if (images.trim() !== "") {
      console.log(`? Test Passed: ${testImage} is present in Docker!`);
    } else {
      console.error(`? Test Failed: ${testImage} is missing!`);
      process.exit(1);
    }

    // Cleanup
    await fs.unlink(tempFile);
    console.log("\n--- All Phase 3 Tests Passed! ---");

  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  }
}

testDockerIntegration();
