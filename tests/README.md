# Tide — Testing Strategy

Three layers, each with a different cost/coverage tradeoff:

## 1. Rust unit tests (`confidential-ixs/src/lib.rs`)

Pure-Rust property tests for the aggregate + distribution math. Runs
fast, no on-chain dependency. 3 tests cover the audit-critical
arithmetic.

```bash
cd confidential-ixs && cargo test
# test_aggregate_three_users      — sum + weighted avg slippage
# test_distribution_pro_rata      — sum of allocations == acquired
# test_empty_intents              — boundary case
```

CI runs this on every push (`.github/workflows/ci.yml` `rust` job).

## 2. Devnet integration scripts (`scripts/test-*.mjs`)

Real on-chain tests against the actual deployed program. These are
THE source of truth for "does the audit-finding fix work?" because
they exercise the same bytecode users hit.

```bash
# Full refund flow (trigger_aggregate → mark_window_failed → refund_intent)
npm run test:refund-flow

# close_intent rent recovery on a settled intent
npm run test:close-intent

# mark_window_failed standalone driver
node scripts/test-fail-window.mjs

# Full lifecycle phase-by-phase
npm run qa:e2e -- init
npm run qa:e2e -- setup
npm run qa:e2e -- commit
npm run qa:e2e -- aggregate
npm run qa:e2e -- swap
npm run qa:e2e -- claim
npm run qa:e2e -- status
```

Each script outputs a real devnet tx signature on success. Pinned
signatures from past runs are linked in:
- `README.md` (lifecycle txs at top)
- `INTEGRITY.md` (audit-finding closure evidence)
- `app/demo/page.tsx` (judge-facing /demo page step links)
- `scripts/qa-sponsors.mjs` QA-12 (refund-flow) + QA-13 (close_intent)
  cross-verify those sigs landed via Solana RPC getTransaction.

## 3. Anchor TypeScript integration tests (`tests/tide.ts`)

Mocha + Anchor provider tests intended to run via `anchor test`. The
suite spins up a local `solana-test-validator`, deploys the program
to it, and exercises instructions in isolation. Useful for fast
iteration during development but require:

- A working `solana-test-validator` binary (works on Linux/Mac; Windows
  needs WSL2)
- Anchor IDL types generated via `anchor build` first

The scaffolded test cases in `tide.ts` map 1:1 to the audit-finding
fixes, so anyone running them locally can verify each closure:

| Test case | Audit finding it closes |
|---|---|
| `init_pool rejects min_pool_size = 0` | Upgrade #3 |
| `commit_intent rejects amount > position.amount_per_window` | Upgrade #1 |
| `commit_intent rejects input_mint != pool.input_mint` | Upgrade #2 (handler check) |
| `init_window rejects prev status in {0, 1}` | Upgrade #6 |
| `mark_window_failed → refund_intent happy path` | Upgrade #4 |
| `close_intent rejects unsettled intent` | Upgrade #5 |
| `execute_swap rejects non-Jupiter program` | Upgrade #1 |

Note that on Windows we exercise these against devnet via the scripts
in (2) above instead. Either path validates the same on-chain logic.

## Why we lead with devnet scripts (2) over mocha (3)

Hackathon-typical mocha tests run against a local validator with
fresh state every time. They catch logic errors but can miss issues
that only appear when the program interacts with real state (Jupiter
account layout drift, ALT resolution, real Pyth feed decoding, etc).

Tide's devnet integration tests run against the EXACT bytecode + state
users hit. Pinned tx signatures make the evidence verifiable by anyone
with a Solana Explorer tab. Reviewer-friendly because every claim in
the README/submission/INTEGRITY.md links to a real on-chain event.

If you want both: run mocha for fast inner-loop dev + devnet scripts
for credibility-grade verification.
