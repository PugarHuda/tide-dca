/**
 * Tide devnet deployment script.
 *
 * Run: anchor migrate
 *
 * Bootstraps a USDC → SOL pool on devnet:
 * 1. Initialize pool with default params (1h window, 0.05% fee)
 * 2. Verify pool account exists + readable
 *
 * Pre-requisites:
 * - Wallet funded (solana airdrop 2)
 * - Anchor.toml updated with deployed program ID
 * - .env.local with HELIUS_DEVNET_RPC
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const USDC_MINT_DEVNET = new PublicKey(
  "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
);
const SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112",
);

const DEFAULT_WINDOW_DURATION = 3600; // 1 hour
const DEFAULT_FEE_BPS = 5; // 0.05%
const DEFAULT_MIN_POOL_SIZE = 100_000_000; // 100 USDC

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);

  // TODO: import Program after anchor build
  // const program = anchor.workspace.Tide;

  console.log("Tide devnet deployment");
  console.log("─".repeat(40));
  console.log(`Provider wallet: ${provider.wallet.publicKey.toBase58()}`);
  console.log(`Cluster: ${provider.connection.rpcEndpoint}`);
  console.log("");

  // Derive pool PDA
  // const [poolPda, bump] = PublicKey.findProgramAddressSync(
  //   [Buffer.from("pool"), USDC_MINT_DEVNET.toBuffer(), SOL_MINT.toBuffer()],
  //   program.programId,
  // );

  // console.log(`Pool PDA: ${poolPda.toBase58()}`);
  // console.log(`Bump: ${bump}`);
  // console.log("");

  // Initialize pool
  // try {
  //   await program.methods
  //     .initPool(
  //       SOL_MINT,
  //       new anchor.BN(DEFAULT_WINDOW_DURATION),
  //       new anchor.BN(DEFAULT_MIN_POOL_SIZE),
  //       DEFAULT_FEE_BPS,
  //     )
  //     .accounts({
  //       authority: provider.wallet.publicKey,
  //       inputMint: USDC_MINT_DEVNET,
  //       pool: poolPda,
  //       systemProgram: SystemProgram.programId,
  //     })
  //     .rpc();
  //   console.log("✓ Pool initialized");
  // } catch (err) {
  //   console.error("✗ Pool init failed:", err);
  // }

  console.log("");
  console.log("⏳ Pool initialization commented out — uncomment after `anchor build` generates IDL");
  console.log("");
  console.log("Next steps:");
  console.log("  1. anchor build");
  console.log("  2. Update Anchor.toml + .env.local with deployed program ID");
  console.log("  3. anchor deploy");
  console.log("  4. Uncomment + re-run: anchor migrate");
};
