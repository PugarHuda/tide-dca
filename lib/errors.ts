/**
 * Anchor error decoder for Tide.
 *
 * Anchor encodes user errors with offset 6000 (= TideError variant index).
 * Order MUST match programs/tide/src/error.rs verbatim — adding a variant
 * means appending here at the same position.
 *
 * Errors that surface in the UI come through several wrapper layers:
 *   - SendTransactionError from @solana/web3.js (has .logs)
 *   - WalletSendTransactionError from wallet-adapter (wraps the above as
 *     .error and surfaces .message = "Unexpected error" if it can't resolve)
 *   - Sometimes the raw simulation error with .cause / .stack / nothing else
 *
 * decodeAnchorError walks all of these defensively.
 */

const TIDE_ERRORS: Record<
  number,
  { code: string; message: string }
> = {
  6000: { code: "PoolAlreadyInitialized", message: "Pool already exists for this token pair." },
  6001: { code: "InvalidWindowDuration", message: "Window duration must be between 60 s and 24 h." },
  6002: { code: "InvalidFeeBps", message: "Fee can't exceed 1% (100 bps)." },
  6003: { code: "InvalidSlippageBps", message: "Slippage tolerance can't exceed 10% (1000 bps)." },
  6004: { code: "InvalidAmount", message: "Amount must be greater than zero." },
  6005: { code: "PositionAlreadyExists", message: "You already have a DCA position on this pool." },
  6006: { code: "PositionInactive", message: "Your DCA position is paused. Re-activate to continue." },
  6007: { code: "WindowClosed", message: "This window already closed for new commits. Wait for the next one." },
  6008: { code: "WindowNotExpired", message: "Window hasn't expired yet — check back when the countdown hits 0." },
  6009: { code: "AlreadyAggregated", message: "Aggregate already triggered for this window." },
  6010: { code: "PoolTooSmall", message: "Aggregate is below the minimum pool size; trigger blocked to avoid bad fills." },
  6011: { code: "AggregateNotReady", message: "Window must be in the Aggregating phase first — run trigger_aggregate." },
  6012: { code: "SwapFailed", message: "Jupiter swap CPI reverted. Check the route data + try again." },
  6013: { code: "SlippageExceeded", message: "Acquired amount fell below the slippage floor — swap rolled back." },
  6014: { code: "AlreadyClaimed", message: "You've already claimed your allocation for this window." },
  6015: { code: "InsufficientBalance", message: "Not enough USDC in your wallet to commit this amount." },
  6016: { code: "InvalidRouteData", message: "Jupiter route data missing — refresh the quote and retry." },
  6017: { code: "Overflow", message: "Arithmetic overflow — retry with smaller amounts." },
};

const TIDE_BY_NAME = new Map(
  Object.entries(TIDE_ERRORS).map(([k, v]) => [v.code, { number: Number(k), ...v }]),
);

/** Walk all candidate error containers — current err + .error + .cause + .data — for logs. */
function collectLogs(err: unknown): string[] {
  const seen = new Set<unknown>();
  const out: string[] = [];

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj.logs)) {
      for (const line of obj.logs) {
        if (typeof line === "string") out.push(line);
      }
    }
    visit(obj.error);
    visit(obj.cause);
    visit(obj.data);
    visit(obj.transactionLogs);
    visit(obj.simulationResponse);
  };

  visit(err);
  return out;
}

/** Walk error tree for any string field that might contain a hex error code. */
function collectMessages(err: unknown): string[] {
  const seen = new Set<unknown>();
  const out: string[] = [];

  const visit = (node: unknown) => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (typeof obj.message === "string") out.push(obj.message);
    visit(obj.error);
    visit(obj.cause);
    visit(obj.data);
    visit(obj.transactionMessage);
  };

  visit(err);
  return out;
}

/**
 * Best-effort friendly message for whatever a wallet adapter / Connection
 * threw during a sendTransaction or simulate. Falls through to "Transaction
 * failed (see console for details)" when nothing matches — also dumps the
 * original error to console for debugging.
 */
export function decodeAnchorError(err: unknown): string {
  // Always log to console so devs can see the real shape if our decoder misses.
  if (typeof window !== "undefined") {
    console.warn("[Tide] tx error:", err);
  }

  const logs = collectLogs(err);
  for (const line of logs) {
    const numMatch = line.match(/Error Number:\s*(\d+)/);
    if (numMatch) {
      const entry = TIDE_ERRORS[Number(numMatch[1])];
      if (entry) return entry.message;
    }
    const codeMatch = line.match(/Error Code:\s*(\w+)/);
    if (codeMatch) {
      const entry = TIDE_BY_NAME.get(codeMatch[1]);
      if (entry) return entry.message;
    }
    // "Program 11111111111111111111111111111111 failed: custom program error: 0x1"
    const hexInLog = line.match(/custom program error:\s*0x([0-9a-fA-F]+)/i);
    if (hexInLog) {
      const entry = TIDE_ERRORS[parseInt(hexInLog[1], 16)];
      if (entry) return entry.message;
    }
  }

  const messages = collectMessages(err);
  for (const m of messages) {
    const hexMatch = m.match(/custom program error:\s*0x([0-9a-fA-F]+)/i);
    if (hexMatch) {
      const entry = TIDE_ERRORS[parseInt(hexMatch[1], 16)];
      if (entry) return entry.message;
    }
    const numMatch = m.match(/Error Number:\s*(\d+)/);
    if (numMatch) {
      const entry = TIDE_ERRORS[Number(numMatch[1])];
      if (entry) return entry.message;
    }
    // simulateTransaction returns { InstructionError: [ixIndex, { Custom: N }] }
    // We stringify it, so search for "Custom":N inside the message.
    const customMatch = m.match(/"Custom"\s*:\s*(\d+)/);
    if (customMatch) {
      const code = Number(customMatch[1]);
      if (code >= 6000) {
        const entry = TIDE_ERRORS[code];
        if (entry) return entry.message;
      }
      // Custom(0) = SystemProgram::AccountAlreadyInUse — Anchor's `init`
      // tried to create_account on a PDA that's already there. The most
      // common cause for Tide is "you already have a position / window /
      // pool depending on which ix this is".
      if (code === 0) {
        return "This account already exists on chain. If you've already set up a DCA position, go to the Dashboard to commit instead. If you're an admin, the pool/window may already be initialized.";
      }
    }
    if (/User rejected|user denied|reject(ed)? the request/i.test(m)) {
      return "Transaction cancelled in wallet.";
    }
    if (/insufficient (lamports|funds)/i.test(m)) {
      return "Not enough SOL to pay tx fees. Top up via the devnet faucet.";
    }
    if (/account does not exist|AccountNotFound/i.test(m)) {
      return "An account this transaction needs doesn't exist yet on chain. Make sure the pool + window are initialized.";
    }
    if (/blockhash not found|BlockhashNotFound/i.test(m)) {
      return "Network busy — blockhash expired. Try again.";
    }
  }

  // Last resort: the raw surface message if we have one, otherwise generic.
  const raw = err instanceof Error ? err.message : String(err);

  // Phantom-specific: "Unexpected error" with no logs/cause means Phantom
  // refused to broadcast (most often: wallet not on devnet, or 0 SOL for
  // tx fees). Surface a concrete checklist instead of the wallet's
  // unhelpful string.
  if (raw === "Unexpected error" || raw === "WalletSendTransactionError") {
    return "Wallet refused the transaction. Check: (1) Phantom is on Devnet (Settings → Developer Settings → Change Network → Devnet), (2) Your wallet has SOL for tx fees (faucet.solana.com), (3) Your wallet has test USDC (use /admin → Mint test USDC).";
  }

  if (raw && raw !== "Unexpected error") return raw;
  return "Transaction failed. Open the browser console to see the full error.";
}
