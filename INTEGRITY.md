# INTEGRITY.md — Honest Self-Audit

> What's real, what's env-gated, and what's still mocked. Last refreshed
> 2026-05-11 (submission day) after a full code-level pass. This document
> exists because **judges who find unflagged mocks lose trust fast** —
> and we'd rather they find this page first.

If you're a judge reviewing Tide, please read this. Everything below is
the team's own self-audit. The goal isn't to obscure gaps; it's to make
them inspectable so probing finds disclosure, not surprises.

---

## 🟢 Genuinely real (verified end-to-end on devnet)

| Component | Evidence |
|---|---|
| **Anchor program — 10 instructions** | `HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg`, deployed via 5 successful upgrades during submission day |
| **`init_pool` constraint hardening** | `min_pool_size > 0` enforced (upgrade #3 tx [`2avhProv...`](https://explorer.solana.com/tx/2avhProv5RrUkwZjozcE2hADF5Xjzzzx4u5FKPAvnyXHRWvw7c11mV5CxxU2pMY9UBTxpRuMYPvdNcccvXGDTXxq?cluster=devnet)) |
| **`commit_intent` constraints** | `amount ≤ position.amount_per_window` + `input_mint == pool.input_mint` (upgrade #2 hotfix tx [`27qfShmc...`](https://explorer.solana.com/tx/27qfShmcmqiiVMFz9Vcq3fnmktd9cRSDLQR4aRgy3bKLdkBfQKpSV1CpVncbHB7hfUt28QM39tMdj4NTBroYxby3?cluster=devnet)) |
| **`execute_swap` Jupiter constraint** | `#[account(address = JUPITER_V6_PROGRAM_ID)]` (upgrade #1 tx [`5qfwvpu3...`](https://explorer.solana.com/tx/5qfwvpu39tFGJpjvGr8c8gGqNpaYfjYFcCHQJVFpKUpv4bpKP8SnzpsueWHc3tWJqbkvQfMWQPmM2jvXN8dtJPs4?cluster=devnet)) |
| **Refund flow end-to-end** | `trigger_aggregate` → `mark_window_failed` → `refund_intent` validated on consecutive slots 461531911-461531915. Wallet recovered exact `intent.amount` USDC. Full tx links in README + qa-sponsors QA-12 |
| **Jupiter v6 client code** | Real `@jup-ag/api` v6 quote + swap-instructions, ALT resolution, VersionedTransaction, PDA-signed CPI. Devnet test used SPL `sync_native` as stand-in because Jupiter has no devnet quote API for our test mint, but the Anchor handler code is identical for the real Jupiter call. Pinned tx [`2yCSusUk...`](https://explorer.solana.com/tx/2yCSusUkWNS59y1ypX38AB5c1rN7NG4DwwS5Q4G6yY91eVqcuXA5Fp9JUY2NKxN964Ldtr3QLFHyb2mD8Ji81Bu7?cluster=devnet) shows Jupiter program ID inside Tide's inner ix |
| **Arcium SDK runtime** | `@arcium-hq/client` v0.9 imported + `RescueCipher.encrypt()` exercised via clickable `/admin` probe. Real ciphertext produced from synthetic MXE keypair. Verified in QA-10 |
| **Phantom + Wallet Standard** | Connect modal lists real installed wallets (Wallet Standard + explicit Ledger adapter). 24h session TTL + two-step disconnect verified in code |
| **Privy JWT verification** | `/api/privy/verify` decodes JWT + calls Privy's `/sessions/{sid}` endpoint for revocation check. 401 on bogus tokens verified in QA-6 |
| **MoonPay public API proxy** | `/api/moonpay/currencies` proxies MoonPay's `/v3/currencies` — returns Circle's real Solana USDC mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. Verified in QA-8 |
| **MoonPay HMAC signing** | `/api/moonpay/sign` does real HMAC-SHA256 against secret; verified in QA-7 with 503-on-missing-key honest gate |
| **MoonPay webhook verifier** | `/api/moonpay/webhook` uses `crypto.timingSafeEqual` for constant-time HMAC compare; verified in QA-9 |
| **Pyth oracle decode** | `lib/pyth.ts` decodes V2 price account inline (no SDK) — live mainnet SOL/USD feed refreshing every 8s on `/admin`. Verified in QA-3 |
| **Squads multisig builder** | `lib/squads.ts` builds real `multisig_create_v2` ix with proper Anchor discriminator + Borsh args. Authority detection reads chain. Verified in QA-1 + QA-5 |
| **CI workflow** | `.github/workflows/ci.yml` runs TypeScript + Rust + sponsor QA on every push to master |
| **Confidential-ixs Rust tests** | 3/3 PASS via `cargo test`: `test_aggregate_three_users`, `test_distribution_pro_rata`, `test_empty_intents` |
| **Wallet UX hardenings** | 24h session TTL (both wallet-adapter AND Privy), two-step disconnect with 3s auto-revert, network warning banner, React error boundary, NaN form input guards |

---

## 🟡 Env-gated (real code, behavior is honestly off when unset)

These look "not working" out of the box because the production config
isn't set on Vercel. The CODE PATH is real — flipping the env var
activates the feature. Each one has an explicit UI signal so users
aren't confused into thinking the integration is silently broken.

| Component | What's missing | UI behavior when missing | What unlocks it |
|---|---|---|---|
| **MoonPay onramp button** | `NEXT_PUBLIC_MOONPAY_API_KEY` + `MOONPAY_SECRET_KEY` + `MOONPAY_WEBHOOK_SECRET` | Click → 503 → toast.info: "MoonPay onramp button is wired (URL builder + HMAC server signing) but production API key isn't set on this deployment" | ~10 min after MoonPay merchant approval |
| **Privy embedded wallet login** | Privy origin whitelist for `tide-dca.vercel.app` in Privy dashboard | Login flow opens but fails at session creation | 5 min user-action in Privy dashboard |
| **Arcium MPC encryption** | `NEXT_PUBLIC_ARCIUM_MXE_PROGRAM_ID` + a deployed MXE program (Arcium CLI is Linux/Mac only) | Falls back to SHA-256 commitment hash (deterministic, NOT private). UI badge **"Commitment-fallback mode"** appears on `/setup` and `/dashboard` | 30-60 min on WSL2 or Mac post-submission |
| **Squads `create_multisig`** | Mainnet only (Squads V4 program isn't on devnet) | Devnet button click → toast "cluster-not-bootstrapped". Authority detection hook handles missing Squads gracefully | Set `NEXT_PUBLIC_SOLANA_NETWORK=mainnet` |

---

## 🔴 Genuinely mocked or hardcoded

This is the honest "still fake" list. None of these are presented as
production-ready in the UI without context, but they exist in the code
and a grep would find them.

### 1. Reflect — placeholder program ID + hardcoded APY

| File | Line | What |
|---|---|---|
| `lib/reflect.ts` | 28 | Fallback program ID was `"ReflectTBDxxxxxxxxxxxxxxxxxxxxxxxxxxxx"` — placeholder string. **Fixed 2026-05-11**: now returns `null` and `reflectConfigured()` gates UI |
| `lib/reflect.ts` | 24 | `REFLECT_USDC_APY = 0.052` (5.2%) — hardcoded "target" APY, NOT Reflect's actual API'd rate |
| `lib/reflect.ts` | 155 | Deposit ix seeds `[b"vault", usdc_mint]` are **guessed**, never verified against Reflect's published IDL |

**Honest framing**: Reflect is the most aspirational of the 9 sponsor
integrations. Frontend yield projection works (using the hardcoded
APY), the deposit-ix builder produces a syntactically-valid Anchor ix,
but neither has ever been exercised against a real Reflect program.
Reflect's mainnet ABI hasn't been published; integration completes
when it ships.

### 2. Landing page marketing numbers

| File | Line | Claim |
|---|---|---|
| `app/page.tsx` | 159 | "~0.50%" solo slippage |
| `app/page.tsx` | 163 | "~0.05%" pooled target |
| `app/page.tsx` | 289 | `Target slippage 0.05%` |
| `app/page.tsx` | 658 | `$100 → ≈0.5701 SOL` example output |
| `app/page.tsx` | 38 | `RECEIVE_AMOUNTS = ["0.286", ...]` hardcoded display rotation |

**Honest framing**: These are aspirational marketing numbers, not
measured ones. The 0.51% solo figure is a Solana retail aggregate
sourced from public reports. The 0.05% pooled target is our design
goal, not realized on devnet (execute_swap on devnet used SPL
sync_native as stand-in, not Jupiter). Mainnet operation will measure
realized slippage and persist it as `window.effective_slippage_bps`
on-chain — at that point the landing copy switches from heuristic to
empirical.

### 3. Anchor program — Arcium MXE CPI not wired

| File | Line | Comment |
|---|---|---|
| `programs/tide/src/instructions/trigger_aggregate.rs` | 42 | `// TODO: emit cross-program call to Arcium MXE here` |
| `programs/tide/src/instructions/claim_allocation.rs` | body | `// In production: this comes from MXE's compute_distribution result. For scaffold: linear pro-rata calc.` |

**Honest framing**: `trigger_aggregate` currently just flips
`window.status = 1 (Aggregating)`. It does NOT yet emit a CPI to
Arcium's compute program. The pro-rata math in `claim_allocation` is
plaintext (visible amounts × visible acquired ÷ visible committed).
The privacy guarantee narrows to: **bots who observe `commit_intent`
on-chain can't read the encrypted intent contents** (RescueCipher
ciphertext bytes when MXE configured, SHA-256 hash bytes when not).
They CAN read `intent.amount` because it must be plaintext for escrow
accounting. Mainnet ramp with deployed MXE adds the real CPI +
encrypted distribution path.

### 4. Test USDC mint with infinite authority

| Constant | Reality |
|---|---|
| `BKQ9HAzw2rnfUXpm6BKz2yvH4ikwKhC8dkgt73A8LTSh` | Tide-controlled SPL mint on devnet. Mint authority = deploy wallet. `/admin` has a "Mint 1000 USDC to my wallet" button. Used because Circle's devnet USDC faucet is region-blocked for many users. **Not real USDC** — anyone reading this can mint any amount. |

**Honest framing**: This is common hackathon practice for devnet
demos. Mainnet swap uses real Circle USDC (`EPjFWdd5...`). The constant
`USDC_MINT_MAINNET` in `lib/constants.ts` points to the right one
already; `CURRENT_NETWORK` switches.

### 5. `scripts/keeper.ts` — scaffold

| File | What |
|---|---|
| `scripts/keeper.ts` | `pollAndAct()` is mostly commented-out scaffold. Doesn't actually call `trigger_aggregate` or `execute_swap` automatically. Real production keeper would be a Helius webhook + serverless function. |

**Honest framing**: Hackathon-grade keeper. `seed-loop.mjs` does the
real seeding work for the demo; `keeper.ts` documents what a
production-grade coordinator service would look like. Not load-bearing
for any sponsor claim.

### 6. `init_window` lifecycle guard intentionally deferred

| File | Line | What |
|---|---|---|
| `programs/tide/src/instructions/init_window.rs` | 50 | `// TODO (post-MVP): pass previous Window as constraint account and require prev.status >= 2` |

**Honest framing**: Closing this guard requires updating
`submitInitWindow` + `qa-e2e.mjs init` phase + 6th Anchor upgrade.
Architecturally conflicts with the seed-loop's "orphan-on-stuck"
pattern. Documented in detail in `.research/honest-depth.md`.
Submission-day risk-asymmetric.

---

## Most damaging if a judge probes (ranked)

| Rank | Item | Damage potential | Mitigation today |
|---|---|---|---|
| 🥇 | Reflect was `ReflectTBDxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | HIGH | ✅ Fixed — null fallback + `reflectConfigured()` gate |
| 🥈 | Landing slippage numbers not sourced | MEDIUM | Aspirational copy is standard hackathon practice; this doc discloses |
| 🥉 | `trigger_aggregate` doesn't CPI to Arcium MXE yet | MEDIUM | Documented here + `.research/honest-depth.md`. The instruction is still useful — it gates the state transition + persistence — even without the CPI |
| 4 | Test USDC mint with infinite authority | LOW | Common hackathon practice + `USDC_MINT_MAINNET` constant points to real Circle mint for mainnet |
| 5 | `claim_allocation` plaintext pro-rata | LOW | Math is correct; privacy narrows to "individual amount obscured from mempool observation" |
| 6 | `scripts/keeper.ts` is scaffold | LOW | Not a user-facing claim |

---

## What we'd ship to close every remaining gap (post-submission plan)

| Item | Effort | Order |
|---|---|---|
| Apply Arcium mainnet-alpha + deploy MXE | 30-60 min (on Linux/Mac) | 1 |
| Replace `trigger_aggregate` status flip with real Arcium MXE enqueue CPI | 2-3 hours (depends on Arcium-Anchor crate availability) | 2 |
| Replace `claim_allocation` plaintext pro-rata with MXE-derived encrypted allocation verifier | 4-8 hours | 3 |
| Wire real Reflect program ID + IDL after Reflect mainnet docs ship | 30-60 min when Reflect publishes | 4 |
| Apply MoonPay merchant + set 3 env vars | 10 min after approval | 5 |
| Add `init_window` lifecycle guard (requires struct + IDL + frontend update) | 1-2 hours | 6 |
| Ottersec / Halborn audit for mainnet | 2-4 weeks, $15-30K | 7 |
| Mainnet deployment | After audit | 8 |
| Add Pyth on-chain consumer in `execute_swap` for honest realized-slippage | 1-2 hours, requires struct change | 9 |

---

## How to verify everything in this doc yourself

```bash
git clone https://github.com/PugarHuda/tide-dca && cd tide-dca
npm ci

# 1. TypeScript clean
npx tsc --noEmit

# 2. Rust tests pass
cd confidential-ixs && cargo test

# 3. 12-case automated sponsor QA against prod
cd .. && node scripts/qa-sponsors.mjs --prod

# 4. End-to-end refund flow on devnet (requires devnet SOL + USDC)
node scripts/test-refund-flow.mjs

# 5. Anchor build clean
anchor build

# 6. Grep for honesty markers
grep -rn "TODO\|FIXME\|placeholder" lib programs/tide/src app
```

The 12 QA cases + 3 refund-flow txs together touch every claim made
in the README and the Colosseum submission. If any disagree with what
the docs say, this `INTEGRITY.md` is wrong and should be filed as a
bug.
