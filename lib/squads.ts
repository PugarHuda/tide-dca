/**
 * Squads V4 multisig detection (used by Altitude / institutional path).
 *
 * Goal: given a pool's `authority` Pubkey, classify whether it is a plain
 * wallet, a Squads V4 multisig account, or unknown. We don't pull the full
 * `@sqds/multisig` SDK — instead we read the account's owner program and
 * (when it is the Squads V4 program) decode the multisig config struct
 * inline. Smaller bundle, no extra deps.
 *
 * The detection enables a real on-chain claim for the Altitude track:
 *  - Pool state on /admin shows authority *type*, not just the pubkey
 *  - Migration roadmap card distinguishes between "single wallet" and
 *    "already a multisig" without needing user input
 *
 * Reference: https://github.com/Squads-Protocol/v4
 */

import { Connection, PublicKey } from "@solana/web3.js";

export const SQUADS_V4_PROGRAM_ID = new PublicKey(
  "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
);

export type AuthorityClassification =
  | { kind: "wallet"; authority: PublicKey }
  | { kind: "multisig"; authority: PublicKey; threshold: number; memberCount: number; staleConfigSlot: bigint }
  | { kind: "program"; authority: PublicKey; owner: PublicKey }
  | { kind: "unknown"; authority: PublicKey; reason: string };

/**
 * Classify an authority pubkey as wallet vs Squads V4 multisig vs other.
 *
 * Returns null cheaply when the pubkey is missing — caller should
 * short-circuit on no-pool / default-pubkey states.
 */
export async function classifyAuthority(
  connection: Connection,
  authority: PublicKey,
): Promise<AuthorityClassification> {
  const info = await connection.getAccountInfo(authority);
  if (!info) {
    // System-program-owned addresses with 0 balance return null; that's
    // a regular wallet that just hasn't received any lamports.
    return { kind: "wallet", authority };
  }
  // Plain wallets are owned by the System program.
  if (info.owner.equals(new PublicKey("11111111111111111111111111111111"))) {
    return { kind: "wallet", authority };
  }
  // Squads V4 multisig — owned by the Squads program.
  if (info.owner.equals(SQUADS_V4_PROGRAM_ID)) {
    try {
      const config = decodeSquadsMultisig(info.data);
      return {
        kind: "multisig",
        authority,
        threshold: config.threshold,
        memberCount: config.memberCount,
        staleConfigSlot: config.staleConfigSlot,
      };
    } catch (err) {
      return {
        kind: "unknown",
        authority,
        reason: `Owned by Squads V4 but decode failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
  // Some other program owns this account — could be a different multisig
  // (Realms, Mango, etc.) or any PDA. We surface the owner pubkey so the
  // /admin UI can display "controlled by program <X>" honestly.
  return { kind: "program", authority, owner: info.owner };
}

/**
 * Squads V4 Multisig account layout (v0.4.x).
 *
 *   discriminator   [u8; 8]
 *   create_key      Pubkey (32)
 *   config_authority Pubkey (32)
 *   threshold       u16
 *   time_lock       u32
 *   transaction_index u64
 *   stale_transaction_index u64
 *   rent_collector  Option<Pubkey>  → 1 byte tag + 32 if Some
 *   bump            u8
 *   members         Vec<Member>     → u32 length + Member[N]
 *
 * We only need threshold + member count (and stale slot for freshness).
 */
function decodeSquadsMultisig(data: Buffer): {
  threshold: number;
  memberCount: number;
  staleConfigSlot: bigint;
} {
  let o = 8;             // discriminator
  o += 32;               // create_key
  o += 32;               // config_authority
  const threshold = data.readUInt16LE(o);
  o += 2;
  o += 4;                // time_lock
  o += 8;                // transaction_index
  const staleConfigSlot = data.readBigUInt64LE(o);
  o += 8;
  // rent_collector option
  const rentCollectorTag = data.readUInt8(o);
  o += 1;
  if (rentCollectorTag === 1) o += 32;
  o += 1;                // bump
  const memberCount = data.readUInt32LE(o);
  return { threshold, memberCount, staleConfigSlot };
}
