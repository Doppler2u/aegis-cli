# Aegis - Zero-Trust Decentralized Container Registry

Aegis is a highly secure, zero-trust container registry built on the **Shelby Protocol** (Decentralized Storage) and the **Aptos Blockchain** (Smart Contract Logic). 

It allows you to securely encrypt and publish Docker images to a decentralized network, and mathematically enforce access control using on-chain smart contracts. No central authority can access your images without your cryptographic permission!

## 🏗️ Architecture (Split-Brain)
- **Shelbynet (Storage)**: The Shelby network acts as a decentralized hard drive. It blindly stores encrypted Docker images (blobs) with sub-second retrieval latency.
- **Aptos Smart Contracts (Logic)**: Our custom `registry.move` smart contract acts as the access control layer. It stores the AES master keys securely on-chain and maps them to authorized wallet addresses.

```mermaid
sequenceDiagram
    participant Owner
    participant CLI as Aegis CLI
    participant Aptos as Aptos Smart Contract (Logic)
    participant Shelby as Shelby Protocol (Storage)

    Owner->>CLI: aegis push <image>
    CLI->>CLI: Encrypt image with AES Master Key
    CLI->>Shelby: Upload encrypted blob
    Shelby-->>CLI: Return Blob ID
    CLI->>Aptos: Publish (Tag, Blob ID, Image Digest)
    
    Owner->>CLI: aegis grant <Friend's Address>
    CLI->>Aptos: Save encrypted AES Key for Friend
    
    Note over Owner,Shelby: --- Friend pulls the image ---
    
    participant Friend
    Friend->>CLI: aegis pull <Owner's Address> <image>
    CLI->>Aptos: Request Blob ID & AES Key
    Aptos-->>CLI: Authenticate & Return Key (if authorized)
    CLI->>Shelby: Download Blob using Blob ID
    Shelby-->>CLI: Return encrypted blob
    CLI->>CLI: Decrypt with AES Key
    CLI->>Friend: Load image into local Docker
```

---

## 🚀 Getting Started

### 1. Prerequisites & Dependencies
You will need the following system software installed on your machine:

- **Node.js (v18+)**: 
  - **Ubuntu/Linux (via NVM):** 
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    nvm install 18
    ```
  - **Windows/Mac:** [Download Node.js](https://nodejs.org/)
- **Docker**: Ensure the Docker daemon is running locally before using the CLI.
  - **Ubuntu/Linux:** 
    ```bash
    sudo apt-get update && sudo apt-get install -y docker.io
    ```
  - **Windows/Mac:** [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 2. Wallet Setup & Faucets
You need an Aptos wallet address (e.g., Petra Wallet) funded with testnet tokens.
Because this project runs on **Shelbynet**, you will need both APT (for gas) and ShelbyUSD (for storage).
- **Aptos (APT) Faucet (For Smart Contract Gas):** `https://docs.shelby.xyz/apis/faucet/aptos`
- **ShelbyUSD (SUSD) Faucet (For Blob Storage):** `https://docs.shelby.xyz/apis/faucet/shelbyusd`

### 3. Installation
Clone the repository and install the CLI dependencies:
```bash
git clone https://github.com/Doppler2u/aegis-cli.git
cd aegis-cli
npm install
```

### 4. Environment Variables
Copy the example environment file and fill in your details:
```bash
cp .env.example .env
```
Inside `.env`, set your `APTOS_PRIVATE_KEY` and `APTOS_ADDRESS` to your funded testnet wallet.

---

## 🛠️ Usage

### Initialize the Repository
Deploy the smart contract (if not already deployed), and initialize your repository on the blockchain:
```bash
npx tsx src/index.ts init
```

### Push a Docker Image
Build your image locally, then encrypt and push it to the decentralized network:
```bash
npx tsx src/index.ts push <your-image-tag:latest>
```
*This command will automatically generate an AES master key, encrypt the Docker image, upload it to Shelby storage, and map the blob ID to your smart contract.*

### Grant Access
Want to share your proprietary image with a friend or colleague? Grant their wallet address access:
```bash
npx tsx src/index.ts grant <FRIENDS_APTOS_ADDRESS>
```
*This securely stores your encrypted AES master key on the Aptos blockchain, allowing only their specific private key to retrieve it.*

### Pull a Docker Image
To download an image, the user must have their private key in their `.env` file and they must have been granted access by the owner:
```bash
npx tsx src/index.ts pull <OWNERS_APTOS_ADDRESS> <image-tag:latest>
```
*This command reads the smart contract, retrieves the blob ID, downloads the encrypted file from Shelby, decrypts it locally, verifies the SHA-256 integrity, and instantly loads it into the local Docker daemon.*

---

## 🔍 Verification & Explorers

Because of the split-brain architecture, you use two different tools to verify your data:

**1. Verifying Storage (Shelby Explorer)**
To prove your file is stored on the decentralized network, visit:
`https://explorer.shelby.xyz/shelbynet/` and search for your Aptos Wallet Address.

**2. Verifying Access Control (Aptos API)**
Because official visual explorers dropped support for custom RPCs, you can verify your Smart Contract state (who has access) by querying the raw blockchain API:
`https://api.shelbynet.shelby.xyz/v1/accounts/<YOUR_ADDRESS>/resources`
*(Search the JSON for "encrypted_keys" to see your authorized users!)*
