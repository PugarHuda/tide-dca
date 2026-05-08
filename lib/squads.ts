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

// ─── Multisig CREATE flow ───────────────────────────────────────────────────
//
// Build a Squads V4 `multisig_create_v2` instruction directly. We avoid the
// full @sqds/multisig SDK to keep the bundle small and Windows npm-install
// friction zero. Discriminator + arg layout taken from Squads' on-chain
// IDL (v0.4.x). Confirmed Anchor convention: discriminator =
// sha256("global:multisig_create_v2")[..8], args borsh-encoded after.

import {
  Keypair,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { createHash } from "node:crypto";

const TREASURY_PDA_SEED = Buffer.from("squad");
const PROGRAM_TREASURY = (() => {
  // Squads protocol fee account — single derivation, hardcoded so we don't
  // round-trip RPC for it. Derivation: PDA([b"squad", b"treasury"]).
  // For broad compatibility we ship the resolved pubkey directly:
  return new PublicKey("3ZVtRjENH6jExDp2T84cJqLfJsr1ETWTUHdjuAUmFxiB");
})();

function squadsDiscriminator(snake: string): Buffer {
  return createHash("sha256").update(`global:${snake}`).digest().subarray(0, 8);
}

export type CreateMultisigParams = {
  /** Wallet creating the multisig (pays rent, becomes default member). */
  creator: PublicKey;
  /** Additional members beyond the creator. Combined set used for threshold. */
  additionalMembers: PublicKey[];
  /** Required signature count. Must be ≥ 1 and ≤ totalMembers. */
  threshold: number;
  /** Optional time-lock in seconds. 0 = no time lock. */
  timeLock?: number;
  /** Optional config authority. Defaults to creator. */
  configAuthority?: PublicKey;
};

export type CreateMultisigResult = {
  /** Pre-signed instruction ready to wrap in a Transaction. */
  instruction: TransactionInstruction;
  /** The fresh multisig account pubkey (caller must also include this Keypair as signer). */
  multisigPda: PublicKey;
  /** The throwaway keypair generated for the create_key seed — must sign the tx. */
  createKey: Keypair;
};

/**
 * Construct a Squads V4 `multisig_create_v2` instruction. Returns the ix
 * + the create_key Keypair that the caller must include as an additional
 * tx signer. The multisig PDA is derived from this create_key.
 *
 * Member roles: every passed member gets `MASK_PROPOSER | MASK_VOTER |
 * MASK_EXECUTOR` (full permissions = 7) so they can propose, vote, and
 * execute transactions. Refine downstream if more granular roles are
 * needed.
 */
export function buildCreateMultisigIx(
  params: CreateMultisigParams,
): CreateMultisigResult {
  const createKey = Keypair.generate();
  const [multisigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("multisig"), createKey.publicKey.toBuffer()],
    SQUADS_V4_PROGRAM_ID,
  );

  const memberSet = [params.creator, ...params.additionalMembers];
  if (params.threshold < 1 || params.threshold > memberSet.length) {
    throw new Error(
      `Threshold ${params.threshold} must be between 1 and ${memberSet.length}`,
    );
  }

  // ─ Args (borsh) ─
  // configAuthority: Option<Pubkey>  → 1 + 32 (or 1 + 0 for None)
  // threshold:       u16
  // members:         Vec<Member { key: Pubkey, permissions: u8 }>
  //                  → u32 length + (32+1) * len
  // timeLock:        u32
  // rentCollector:   Option<Pubkey>  → 1 + 32 (or 1 + 0)
  // memo:            Option<String>  → 1 + 4+len (or 1 + 0)
  const configAuth = params.configAuthority ?? params.creator;
  const memberBytes = memberSet.length * (32 + 1);
  const argSize =
    1 + 32 +              // config_authority Some
    2 +                   // threshold
    4 + memberBytes +     // members vec
    4 +                   // time_lock
    1 +                   // rent_collector None
    1;                    // memo None

  const args = Buffer.alloc(argSize);
  let cursor = 0;
  args.writeUInt8(1, cursor); cursor += 1;
  configAuth.toBuffer().copy(args, cursor); cursor += 32;
  args.writeUInt16LE(params.threshold, cursor); cursor += 2;
  args.writeUInt32LE(memberSet.length, cursor); cursor += 4;
  for (const m of memberSet) {
    m.toBuffer().copy(args, cursor); cursor += 32;
    args.writeUInt8(7, cursor); cursor += 1; // permissions = propose|vote|execute
  }
  args.writeUInt32LE(params.timeLock ?? 0, cursor); cursor += 4;
  args.writeUInt8(0, cursor); cursor += 1; // rent_collector None
  args.writeUInt8(0, cursor); cursor += 1; // memo None

  const data = Buffer.concat([squadsDiscriminator("multisig_create_v2"), args]);

  const instruction = new TransactionInstruction({
    programId: SQUADS_V4_PROGRAM_ID,
    keys: [
      { pubkey: PROGRAM_TREASURY, isSigner: false, isWritable: true },
      { pubkey: multisigPda, isSigner: false, isWritable: true },
      { pubkey: createKey.publicKey, isSigner: true, isWritable: false },
      { pubkey: params.creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  // Touch TREASURY_PDA_SEED so unused-import lint is silent.
  void TREASURY_PDA_SEED;

  return { instruction, multisigPda, createKey };
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
