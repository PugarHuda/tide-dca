/**
 * Arcium client integration for Tide.
 *
 * Browser-side encryption of DCA intents before submission to Anchor program.
 * After Cohort 2 Private Testnet access, replace stubs with real `@arcium/client` calls.
 *
 * Docs: https://docs.arcium.com (TBD when public)
 */

/** Encrypted intent metadata (what we store on-chain). */
export interface EncryptedIntent {
  /** SHA-256 hash of encrypted intent (for on-chain commit verification). */
  intentHash: Uint8Array;
  /** Encrypted shares to be sent to Arcium MXE nodes (off-chain via Arcium SDK). */
  encryptedShares: Uint8Array;
  /** Visible amount (must match what user locks in escrow). */
  visibleAmount: bigint;
}

export interface IntentParams {
  /** Amount of input token (USDC lamports). */
  amount: bigint;
  /** Max acceptable slippage in basis points. */
  maxSlippageBps: number;
  /** User's wallet pubkey (for nullifier derivation). */
  userPubkey: string;
  /** Window account pubkey (for nullifier scoping). */
  windowPubkey: string;
}

/**
 * Encrypt a DCA intent for submission to Arcium MXE.
 *
 * STUB IMPLEMENTATION — replace with real Arcium client SDK after Cohort 2 access.
 * Real flow:
 * 1. Generate ephemeral key
 * 2. Split intent into N shares (Shamir Secret Sharing or similar)
 * 3. Encrypt each share with corresponding MXE node's pubkey
 * 4. Send shares to MXE network (off-chain) — this happens server-side or via Arcium client
 * 5. Return on-chain commit hash + visible amount
 */
export async function encryptIntent(params: IntentParams): Promise<EncryptedIntent> {
  // STUB: hash the parameters as placeholder for real encryption
  const encoder = new TextEncoder();
  const data = encoder.encode(
    `${params.userPubkey}:${params.windowPubkey}:${params.amount}:${params.maxSlippageBps}`,
  );
  // Cast through unknown — TS 5.7 stricter Uint8Array<ArrayBufferLike> vs BufferSource.
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
  const intentHash = new Uint8Array(hashBuffer);

  return {
    intentHash,
    encryptedShares: new Uint8Array(0), // TODO: real shares from Arcium SDK
    visibleAmount: params.amount,
  };
}

/**
 * Decrypt user's pro-rata allocation post-distribute.
 *
 * STUB — Arcium MXE returns encrypted allocations after compute_distribution.
 * User decrypts only their own share via their key.
 */
export async function decryptAllocation(
  encryptedAllocation: Uint8Array,
  userPrivateKey: Uint8Array,
): Promise<bigint> {
  // STUB
  void encryptedAllocation;
  void userPrivateKey;
  return 0n;
}

/**
 * Trigger MXE aggregate compute (called by indexer/keeper post window close).
 *
 * STUB — real flow involves MXE coordinator call.
 */
export async function triggerAggregate(
  windowPubkey: string,
  intentHashes: Uint8Array[],
): Promise<{ totalAmount: bigint; participantCount: number }> {
  void windowPubkey;
  void intentHashes;
  // STUB result
  return { totalAmount: 0n, participantCount: 0 };
}
