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
 * Per-(user, window) nullifier so a single user can't double-commit to the
 * same window. Deterministic SHA-256 of "user:window" so the on-chain check
 * sees the same bytes regardless of who computes them.
 *
 * Real Arcium SDK will likely expose its own nullifier helper that accepts
 * extra entropy from the MXE coordinator; this is the API shape we'd
 * preserve at the Tide-frontend boundary.
 */
export async function deriveNullifier(
  userPubkey: string,
  windowPubkey: string,
): Promise<Uint8Array> {
  const data = new TextEncoder().encode(`tide:nullifier:${userPubkey}:${windowPubkey}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
  return new Uint8Array(hashBuffer);
}

/**
 * Encrypt a DCA intent for submission to Arcium MXE.
 *
 * STUB IMPLEMENTATION — see ARCIUM.md for the exact code change list when
 * Cohort 2 SDK access lands. Real flow:
 *   1. Build inputs object {amount, max_slippage_bps}
 *   2. Call arcium.encryptShares({ function: "aggregate_intents", inputs, nullifier })
 *   3. Returns commitmentHash (lands on-chain) + shares (off-chain to MXE)
 *
 * The stub here returns a deterministic hash so on-chain commit_intent has
 * 32 bytes to store. It is NOT cryptographically meaningful and the demo
 * narration must say so explicitly.
 */
export async function encryptIntent(params: IntentParams): Promise<EncryptedIntent> {
  // Stub commitment: hash(nullifier || amount || slippage). Same shape the
  // real SDK returns, but plaintext-derivable so judges can verify the wiring
  // without the MXE running.
  const nullifier = await deriveNullifier(params.userPubkey, params.windowPubkey);
  const amountBuf = new Uint8Array(8);
  new DataView(amountBuf.buffer).setBigUint64(0, params.amount, true);
  const slippageBuf = new Uint8Array(2);
  new DataView(slippageBuf.buffer).setUint16(0, params.maxSlippageBps, true);

  const combined = new Uint8Array(nullifier.length + amountBuf.length + slippageBuf.length);
  combined.set(nullifier, 0);
  combined.set(amountBuf, nullifier.length);
  combined.set(slippageBuf, nullifier.length + amountBuf.length);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    combined as unknown as BufferSource,
  );
  const intentHash = new Uint8Array(hashBuffer);

  return {
    intentHash,
    encryptedShares: new Uint8Array(0), // real Arcium shares fill this
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
