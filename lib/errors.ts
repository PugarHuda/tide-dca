/**
 * Anchor error decoder for Tide.
 *
 * Anchor encodes user errors with offset 6000 (= TideError variant index).
 * Order MUST match programs/tide/src/error.rs verbatim — adding a variant
 * means appending here at the same position.
 *
 * When a tx reverts the wallet adapter throws a SendTransactionError whose
 * `logs` array contains lines like:
 *
 *   "Program log: AnchorError occurred. Error Code: WindowNotExpired.
 *    Error Number: 6008. Error Message: Window not yet expired."
 *
 * or sometimes just:
 *
 *   "Program ... failed: custom program error: 0x1778"
 *
 * decodeAnchorError() handles both shapes and returns a friendly string.
 */

const TIDE_ERRORS: Record<
  number,
  { code: string; message: string }
> = {
  6000: {
    code: "PoolAlreadyInitialized",
    message: "Pool already exists for this token pair.",
  },
  6001: {
    code: "InvalidWindowDuration",
    message: "Window duration must be between 60 s and 24 h.",
  },
  6002: {
    code: "InvalidFeeBps",
    message: "Fee can't exceed 1% (100 bps).",
  },
  6003: {
    code: "InvalidSlippageBps",
    message: "Slippage tolerance can't exceed 10% (1000 bps).",
  },
  6004: {
    code: "InvalidAmount",
    message: "Amount must be greater than zero.",
  },
  6005: {
    code: "PositionAlreadyExists",
    message: "You already have a DCA position on this pool.",
  },
  6006: {
    code: "PositionInactive",
    message: "Your DCA position is paused. Re-activate to continue.",
  },
  6007: {
    code: "WindowClosed",
    message:
      "This window already closed for new commits. Wait for the next one.",
  },
  6008: {
    code: "WindowNotExpired",
    message: "Window hasn't expired yet — check back when the countdown hits 0.",
  },
  6009: {
    code: "AlreadyAggregated",
    message: "Aggregate already triggered for this window.",
  },
  6010: {
    code: "PoolTooSmall",
    message:
      "Aggregate is below the minimum pool size; trigger blocked to avoid bad fills.",
  },
  6011: {
    code: "AggregateNotReady",
    message:
      "Window must be in the Aggregating phase first — run trigger_aggregate.",
  },
  6012: {
    code: "SwapFailed",
    message: "Jupiter swap CPI reverted. Check the route data + try again.",
  },
  6013: {
    code: "SlippageExceeded",
    message:
      "Acquired amount fell below the slippage floor — swap rolled back.",
  },
  6014: {
    code: "AlreadyClaimed",
    message: "You've already claimed your allocation for this window.",
  },
  6015: {
    code: "InsufficientBalance",
    message: "Not enough USDC in your wallet to commit this amount.",
  },
  6016: {
    code: "InvalidRouteData",
    message: "Jupiter route data missing — refresh the quote and retry.",
  },
  6017: {
    code: "Overflow",
    message: "Arithmetic overflow — retry with smaller amounts.",
  },
};

/**
 * Best-effort friendly message for whatever a wallet adapter / Connection
 * threw during a sendTransaction or simulate. Falls through to the original
 * `err.message` when nothing matches so the user always sees *something*.
 */
export function decodeAnchorError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // 1. Look at err.logs (SendTransactionError) for AnchorError lines.
  const logs: string[] = ((): string[] => {
    if (
      err &&
      typeof err === "object" &&
      "logs" in err &&
      Array.isArray((err as { logs?: unknown }).logs)
    ) {
      return (err as { logs: string[] }).logs;
    }
    return [];
  })();

  for (const line of logs) {
    // "Error Number: 6008"
    const numMatch = line.match(/Error Number:\s*(\d+)/);
    if (numMatch) {
      const code = Number(numMatch[1]);
      const entry = TIDE_ERRORS[code];
      if (entry) return entry.message;
    }
    // "Error Code: WindowNotExpired"
    const codeMatch = line.match(/Error Code:\s*(\w+)/);
    if (codeMatch) {
      const codeName = codeMatch[1];
      const entry = Object.values(TIDE_ERRORS).find((e) => e.code === codeName);
      if (entry) return entry.message;
    }
  }

  // 2. Fall back to "custom program error: 0xNNNN" in the raw message.
  const hexMatch = raw.match(/custom program error:\s*0x([0-9a-fA-F]+)/i);
  if (hexMatch) {
    const code = parseInt(hexMatch[1], 16);
    const entry = TIDE_ERRORS[code];
    if (entry) return entry.message;
  }

  // 3. Common wallet-adapter messages that aren't on-chain.
  if (/User rejected|user denied|reject(ed)? the request/i.test(raw)) {
    return "Transaction cancelled.";
  }
  if (/insufficient (lamports|funds)/i.test(raw)) {
    return "Not enough SOL to pay tx fees. Top up via the devnet faucet.";
  }

  return raw;
}
