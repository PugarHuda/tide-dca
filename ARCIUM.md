# Tide — Arcium MXE Integration Plan

> Where Arcium fits in Tide's mechanism, what's stubbed today, and the exact
> code-change list to flip from stub to real MPC.
>
> **Status as of 2026-05-09**: Arcium **mainnet-alpha is LIVE** on Solana
> mainnet (per https://docs.arcium.com). Earlier this doc referenced
> "Cohort 2 approval"; that gating is gone. Path is:
> 1. Install Arcium CLI on Linux/Mac (Windows not supported — needs WSL2)
> 2. Build + deploy our `confidential-ixs/` as an MXE program
> 3. Wire `@arcium-hq/client` (already published, npm-installable)
> 4. Update `lib/arcium.ts` to call real `RescueCipher` instead of SHA-256 stub

---

## Why Arcium

Tide's pitch is "DCA without MEV." That requires individual user amounts to be
hidden during the commit window — otherwise a sandwich bot reads the pending
buy order, frontruns, and dumps. Aggregating multiple users into one swap is
half the answer; the other half is keeping each user's *individual* amount
secret so the bot can't extrapolate the aggregate from a single visible commit.

Arcium MXE (Multi-Party eXecution) lets a confidential function run across
MPC nodes without any single node seeing the plaintext inputs. We use it for
exactly two computations:

1. **`aggregate_intents`** — encrypted user intents → public total + count
2. **`compute_distribution`** — total acquired tokens → encrypted per-user allocations

Both are implemented in `confidential-ixs/src/lib.rs` as Rust functions with
unit tests. The same logic ports to Arcium's Arcis DSL (annotated with
`#[confidential]` + masked types like `mu64`/`mu16`) once the SDK is available.

---

## What's stubbed today

| Layer | File | Status |
|---|---|---|
| Browser-side encryption | `lib/arcium.ts` | Stub — returns SHA-256 of plaintext as the "intent hash" |
| Confidential compute | `confidential-ixs/src/lib.rs` | Plaintext Rust impl with unit tests; Arcis annotation pending |
| Anchor program: store hash | `programs/tide/src/instructions/commit_intent.rs` | Wired (`encrypted_intent_hash: [u8; 32]` arg) |
| Anchor program: trigger MXE | `programs/tide/src/instructions/trigger_aggregate.rs` | Status flip only — no CPI to Arcium yet (TODO comment in handler) |
| Anchor program: callback | not implemented | Need a `mxe_callback` instruction MXE invokes when result is ready |
| Distribution flow | `programs/tide/src/instructions/claim_allocation.rs` | Pro-rata fallback in plaintext (line 75-78); MXE will replace this |

Calling out the deception risk: until the real MXE is wired, individual amounts
are *visible* on chain via `Intent::amount`. The DEMO.md MVP path is honest
about this — show the UX as "designed for Arcium" rather than "powered by
Arcium today."

---

## Real integration: code-change list

The migration from SHA-256 stub to real MPC is now config + small code
changes. Real package + API names from `@arcium-hq/client` v0.9.x:

### Frontend (`lib/arcium.ts`)

```ts
// Real Arcium browser-side encryption uses the RescueCipher + x25519
// key exchange. The MXE-published public key is fetched at runtime
// from the deployed MXE program; client generates its own keypair,
// computes a shared secret, encrypts intent inputs.
import { RescueCipher, x25519 } from "@arcium-hq/client";
import { randomBytes } from "node:crypto";

export async function encryptIntent(
  params: IntentParams,
  mxePublicKey: Uint8Array,
): Promise<EncryptedIntent> {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  const nonce = randomBytes(16);
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);

  const plaintext = [
    BigInt(params.amount),
    BigInt(params.maxSlippageBps),
  ];
  const ciphertext = cipher.encrypt(plaintext, nonce);

  const commitmentHash = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array([...ciphertext, ...publicKey, ...nonce]),
  );

  return {
    intentHash: new Uint8Array(commitmentHash),
    encryptedShares: new Uint8Array(ciphertext),
    visibleAmount: params.amount,
  };
}
```

`mxePublicKey` is fetched once at app load via Arcium's `getMXEPublicKeyWithRetry`
helper (or equivalent), keyed by our deployed MXE program id. Cached so users
don't re-fetch each commit.

The visible amount stays on-chain (we need it in escrow accounting), but
`max_slippage_bps` becomes encrypted-only inside the MXE shares.

### Confidential compute (`confidential-ixs/src/lib.rs`)

Add the Arcis annotations + masked types. The current pure-Rust impl already
matches the Arcis pattern — just swap concrete types.

```rust
use arcis_sdk::prelude::*;

#[confidential]
pub fn aggregate_intents(intents: &[EncryptedIntent]) -> AggregateResult {
    // body unchanged — masked operations propagate types automatically
}

#[derive(Clone)]
pub struct EncryptedIntent {
    pub amount: mu64,                 // masked
    pub max_slippage_bps: mu16,       // masked
    pub nullifier: [u8; 32],          // public
}
```

Tests in the bottom of the file should keep passing because the masked types
delegate to the underlying integer ops in plaintext mode (Arcis ships a
plaintext fallback for unit testing).

### Anchor program: trigger CPI to MXE

Add to `programs/tide/src/instructions/trigger_aggregate.rs`:

```rust
use arcium_anchor::cpi::accounts::EnqueueComputation;

let cpi_accounts = EnqueueComputation {
    requester: ctx.accounts.caller.to_account_info(),
    computation_account: ctx.accounts.computation_account.to_account_info(),
    // ... other Arcium-required accounts
};
arcium_anchor::cpi::enqueue_computation(
    CpiContext::new(arcium_program, cpi_accounts),
    "aggregate_intents".to_string(),
    inputs_serialized,
)?;
```

### Anchor program: MXE callback handler

New instruction `mxe_callback(result_hash, total, count)` that MXE invokes via
its callback program. Verifies caller is the Arcium computation program,
writes `aggregate_result_hash`, `total_committed_usdc`, `intent_count` to the
Window account.

```rust
#[derive(Accounts)]
pub struct MxeCallback<'info> {
    #[account(constraint = caller.key() == ARCIUM_COMPUTATION_PROGRAM)]
    pub caller: Signer<'info>,
    #[account(mut)]
    pub window: Account<'info, Window>,
    // ... result fields passed as args
}

pub fn handler(
    ctx: Context<MxeCallback>,
    aggregate_result_hash: [u8; 32],
    total_amount: u64,
    participant_count: u32,
) -> Result<()> {
    let window = &mut ctx.accounts.window;
    require!(window.status == 1, TideError::AggregateNotReady);
    window.aggregate_result_hash = aggregate_result_hash;
    // total_committed_usdc + intent_count are already populated from
    // commit_intent — MXE just confirms them.
    Ok(())
}
```

### Anchor program: replace plaintext distribution

In `claim_allocation.rs`, the current pro-rata calc:

```rust
let allocation = (intent.amount as u128)
    .checked_mul(window.tokens_acquired as u128)
    .and_then(|v| v.checked_div(window.total_committed_usdc as u128))
    .ok_or(TideError::Overflow)? as u64;
```

is replaced with a verification path: user submits their MXE-decrypted
allocation + a proof; the program verifies the proof against the aggregate
result hash on the Window. Concrete shape depends on Arcium's verifier API.

---

## Test strategy

The unit tests in `confidential-ixs/src/lib.rs` (`test_aggregate_three_users`,
`test_distribution_pro_rata`, `test_empty_intents`) lock in the math. They
should keep passing through the Arcis port — `cargo test` runs them in the
plaintext fallback. If a refactor breaks one of them, the on-chain mechanism
diverges from what `compute_distribution` was originally specified to do.

Frontend has no Arcium tests today — once the SDK lands, add a vitest covering
`encryptIntent` returns a 32-byte hash for known inputs (deterministic given
fixed nullifier).

---

## Dependencies on external accounts

This integration is gated behind manual application steps tracked in `SETUP.md`
Section 4 ("Arcium Cohort 2 Application"). The application typically takes
1-7 days. Captured here for completeness:

1. Apply at https://arcium.com/build with the Tide use case
2. Receive cluster URL + API key
3. `npm i @arcium/client` (when SDK published)
4. `cargo add arcium-anchor` (when crate published)
5. Apply the code changes above

---

## Honest disclosure for hackathon submission

The submission text should phrase this as:

> "Encrypted commits via Arcium MXE — design verified against Arcium's
>  published Arcis pattern, with a working plaintext fallback shipping today
>  (see `confidential-ixs/src/lib.rs` unit tests). Cohort 2 application
>  pending; full MXE wiring lands the moment SDK access opens."

This is more credible than overclaiming and matches what other hackathon teams
in the same boat have done successfully (Archer Exchange's Cypherpunk win was
positioned similarly while Arcium was still permissioned).
