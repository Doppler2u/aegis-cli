import { Account } from "@aptos-labs/ts-sdk";
import fs from "fs";

const account = Account.generate();
const pk = account.privateKey.toString();
const address = account.accountAddress.toString();

const envContent = `APTOS_NODE_URL=https://api.shelbynet.shelby.xyz/v1
SHELBY_RPC_URL=https://api.shelbynet.shelby.xyz/shelby
APTOS_PRIVATE_KEY=${pk}
APTOS_ADDRESS=${address}
`;

fs.writeFileSync('.env', envContent);

console.log('Wallet generated! Address:', address);
console.log('Please fund at:');
console.log('APT: https://docs.shelby.xyz/apis/faucet/aptos?address=' + address);
console.log('SUSD: https://docs.shelby.xyz/apis/faucet/shelbyusd?address=' + address);
