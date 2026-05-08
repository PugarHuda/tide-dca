import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const owner = new PublicKey("FvyseLeVrGb1frkscvGJvtiwzrBMyuB54CLMrDaGKbtP");
const SOL = new PublicKey("So11111111111111111111111111111111111111112");
const ata = getAssociatedTokenAddressSync(SOL, owner);

const bal = await conn.getTokenAccountBalance(ata);
console.log("wSOL ATA:", ata.toBase58());
console.log("Balance:", bal.value.uiAmountString, "wSOL");
console.log("Lamports:", bal.value.amount);
