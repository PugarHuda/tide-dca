/**
 * Arcium client integration for Tide.
 *
 * Browser-side encryption of DCA intents using Arcium's production
 * `@arcium-hq/client` SDK (mainnet-alpha is live as of May 2026).
 *
 * Operating modes:
 *   - **Real MPC** (when NEXT_PUBLIC_ARCIUM_MXE_PROGRAM_ID + an MXE
 *     public key are available): RescueCipher + x25519 key exchange,
 *     ciphertext to be relayed to Arcium nodes
 *   - **Commitment fallback** (everywhere else, e.g. devnet): deterministic
 *     SHA-256 over (nullifier || amount || slippage). Anyone with the
 *     plaintext can recompute it — the on-chain interface is preserved
 *     so swapping in real MPC is a zero-code-shape change once an MXE
 *     is deployed
 *
 * Why both: arcium CLI is Linux/Mac only, so we can't deploy our
 * `confidential-ixs/` MXE program from this Windows hackathon environment.
 * Once that step happens (post-submission, in WSL2 or on a Mac), the
 * NEXT_PUBLIC_ARCIUM_MXE_PROGRAM_ID env var flips on real encryption
 * automatically — no client code change needed.
 *
 * Docs: https://docs.arcium.com
 * Package: https://www.npmjs.com/package/@arcium-hq/client
 */

import { RescueCipher, x25519 } from "@arcium-hq/client";

/** Encrypted intent metadata (what we store on-chain + off-chain). */
export interface EncryptedIntent {
  /** 32-byte commitment hash — lands on Solana via commit_intent. */
  intentHash: Uint8Array;
  /** Ciphertext shares for MXE nodes (off-chain), or empty in fallback. */
  encryptedShares: Uint8Array;
  /** x25519 public key the client used for this commit (so MXE knows the
   *  shared secret derivation). Empty in fallback. */
  ephemeralPubkey: Uint8Array;
  /** Nonce used for RescueCipher encryption. Empty in fallback. */
  nonce: Uint8Array;
  /** Visible amount — must match what user locks in escrow. */
  visibleAmount: bigint;
}

export interface IntentParams {
  /** Amount of input token (USDC lamports, 6 decimals). */
  amount: bigint;
  /** Max acceptable slippage in basis points. */
  maxSlippageBps: number;
  /** User's wallet pubkey (for nullifier derivation). */
  userPubkey: string;
  /** Window account pubkey (for nullifier scoping). */
  windowPubkey: string;
  /** Optional: MXE x25519 public key. When supplied, encryption uses
   *  RescueCipher. Otherwise falls back to SHA-256 commitment. */
  mxePublicKey?: Uint8Array;
}

/** True when env vars are populated for real MXE encryption. */
export function arciumConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_ARCIUM_MXE_PROGRAM_ID;
}

/**
 * Per-(user, window) nullifier — prevents a single user from double
 * committing to the same window. SHA-256 over "tide:nullifier:user:window"
 * is deterministic so on-chain check sees the same bytes regardless of
 * who computes it.
 */
export async function deriveNullifier(
  userPubkey: string,
  windowPubkey: string,
): Promise<Uint8Array> {
  const data = new TextEncoder().encode(
    `tide:nullifier:${userPubkey}:${windowPubkey}`,
  );
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data as unknown as BufferSource,
  );
  return new Uint8Array(hashBuffer);
}

/**
 * Encrypt a DCA intent. Uses real `RescueCipher` when an MXE public key
 * is provided, otherwise produces a deterministic SHA-256 commitment.
 *
 * The `intentHash` shape is identical in both modes (32 bytes), so the
 * on-chain `commit_intent` ix accepts either. Demo narration should say
 * "running in commitment mode" when MXE is unconfigured.
 */
export async function encryptIntent(
  params: IntentParams,
): Promise<EncryptedIntent> {
  if (params.mxePublicKey) {
    return encryptIntentWithMXE(params, params.mxePublicKey);
  }
  return encryptIntentCommitmentFallback(params);
}

/** Real MPC encryption path — uses Arcium's RescueCipher + x25519 ECDH. */
async function encryptIntentWithMXE(
  params: IntentParams,
  mxePublicKey: Uint8Array,
): Promise<EncryptedIntent> {
  // Generate ephemeral x25519 keypair for this commit
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);

  // Compute shared secret via ECDH with MXE
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);

  // 16-byte nonce — must be unique per commit
  const nonce = crypto.getRandomValues(new Uint8Array(16));

  // Encrypt (amount, max_slippage_bps) as bigint pair
  const plaintext = [
    BigInt(params.amount),
    BigInt(params.maxSlippageBps),
  ];
  const ciphertext = cipher.encrypt(plaintext, nonce);

  // Build the on-chain commitment hash:
  // sha256(ciphertext || ephemeralPubkey || nonce || nullifier)
  const nullifier = await deriveNullifier(params.userPubkey, params.windowPubkey);
  const ciphertextBytes = flattenCiphertext(ciphertext);
  const combined = new Uint8Array(
    ciphertextBytes.length + publicKey.length + nonce.length + nullifier.length,
  );
  let offset = 0;
  combined.set(ciphertextBytes, offset); offset += ciphertextBytes.length;
  combined.set(publicKey, offset);       offset += publicKey.length;
  combined.set(nonce, offset);           offset += nonce.length;
  combined.set(nullifier, offset);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    combined as unknown as BufferSource,
  );

  return {
    intentHash: new Uint8Array(hashBuffer),
    encryptedShares: ciphertextBytes,
    ephemeralPubkey: publicKey,
    nonce,
    visibleAmount: params.amount,
  };
}

/** Fallback commitment for environments without an active MXE. The
 *  hash shape matches the MXE path so on-chain `commit_intent` accepts
 *  either. NOT cryptographically private — anyone with the plaintext
 *  can recompute. */
async function encryptIntentCommitmentFallback(
  params: IntentParams,
): Promise<EncryptedIntent> {
  const nullifier = await deriveNullifier(
    params.userPubkey,
    params.windowPubkey,
  );
  const amountBuf = new Uint8Array(8);
  new DataView(amountBuf.buffer).setBigUint64(0, params.amount, true);
  const slippageBuf = new Uint8Array(2);
  new DataView(slippageBuf.buffer).setUint16(0, params.maxSlippageBps, true);

  const combined = new Uint8Array(
    nullifier.length + amountBuf.length + slippageBuf.length,
  );
  combined.set(nullifier, 0);
  combined.set(amountBuf, nullifier.length);
  combined.set(slippageBuf, nullifier.length + amountBuf.length);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    combined as unknown as BufferSource,
  );

  return {
    intentHash: new Uint8Array(hashBuffer),
    encryptedShares: new Uint8Array(0),
    ephemeralPubkey: new Uint8Array(0),
    nonce: new Uint8Array(0),
    visibleAmount: params.amount,
  };
}

/** Flatten RescueCipher ciphertext into a single byte sequence.
 *  RescueCipher.encrypt returns `number[][]` where each row is already
 *  serialized to 32 bytes. */
function flattenCiphertext(ciphertext: number[][]): Uint8Array {
  const all: number[] = [];
  for (const row of ciphertext) {
    for (const elem of row) all.push(elem & 0xff);
  }
  return new Uint8Array(all);
}

/**
 * Decrypt user's pro-rata allocation post-distribute. Real Arcium MXE
 * returns encrypted allocations after compute_distribution; user decrypts
 * via their stored ephemeralPrivateKey. Stubbed until MXE is deployed.
 */
export async function decryptAllocation(
  encryptedAllocation: Uint8Array,
  userPrivateKey: Uint8Array,
): Promise<bigint> {
  void encryptedAllocation;
  void userPrivateKey;
  // TODO: when MXE is deployed, use RescueCipher with the same shared
  // secret derivation against the MXE public key, then decrypt the
  // user's allocated amount.
  return 0n;
}
