# Changelog

Notable changes during the Solana Frontier 2026 (Colosseum) submission
hackathon. Format loosely follows [Keep a Changelog](https://keepachangelog.com/)
but reorganized by the natural arc of the build cycle: scaffold → idea
hardening → audit response → production polish.

---

## 2026-05-11 — Submission day push (Rounds 7–12)

### Audit response on-chain

Internal QA review on submission day surfaced 5 audit findings on the
deployed Anchor program. **All 5 closed in code; 4 deployed via 7
successful on-chain upgrades during the submission window.**

| Upgrade | Tx | Finding closed |
|---|---|---|
| #1 | [`5qfwvpu3`](https://explorer.solana.com/tx/5qfwvpu39tFGJpjvGr8c8gGqNpaYfjYFcCHQJVFpKUpv4bpKP8SnzpsueWHc3tWJqbkvQfMWQPmM2jvXN8dtJPs4?cluster=devnet) | Jupiter v6 program ID constrained + commit amount/input_mint bounds |
| #2 | [`27qfShmc`](https://explorer.solana.com/tx/27qfShmcmqiiVMFz9Vcq3fnmktd9cRSDLQR4aRgy3bKLdkBfQKpSV1CpVncbHB7hfUt28QM39tMdj4NTBroYxby3?cluster=devnet) | Hotfix: input_mint check moved to handler (stack overflow) |
| #3 | [`2avhProv`](https://explorer.solana.com/tx/2avhProv5RrUkwZjozcE2hADF5Xjzzzx4u5FKPAvnyXHRWvw7c11mV5CxxU2pMY9UBTxpRuMYPvdNcccvXGDTXxq?cluster=devnet) | `init_pool` rejects `min_pool_size_usdc == 0` |
| #4 | [`23f5YfeR`](https://explorer.solana.com/tx/23f5YfeRK44cSUBhnmZe5mWV9CdL4gHXaAtT9p8UZHi3SiC5HQSnaGDNMqzpWUe524tpqduwugBcA7ZWrh2s3UCr?cluster=devnet) | New ix: `mark_window_failed` + `refund_intent` + tightened `claim_allocation` |
| #5 | [`2fWLquM8`](https://explorer.solana.com/tx/2fWLquM8ykmJkbNy9hvatdQjztmGxvPHEnxX1Aqph72gWKZ3PhjpRasTTQ81RBwntWrSxpDrBMYkJwibpcc4Z3Zn?cluster=devnet) | New ix: `close_intent` — reclaim rent post-settlement |
| #6 | [`5CL3jUYG`](https://explorer.solana.com/tx/5CL3jUYGGLfXSoMbooxzcwUs7j4GnirNKiwd5TuzK3rqusBu8qrbnw6ZMPkdWm9wFPV1PpgAynb29gduTCKievZ2?cluster=devnet) | `init_window` lifecycle guard (requires prev.status ≥ 2) |
| #7 | [`51H3XYnB`](https://explorer.solana.com/tx/51H3XYnB8nQBuepmAiGVVQCY5S9Pt1tqXwz94DiZzmudV7B2TSfc5mE7bbpPz2KUEEjeD5us82QGCNb7NRN9jkQS?cluster=devnet) | Pyth on-chain consumer in `execute_swap` — honest realized slippage |

**Program now ships 10 instructions** (was 7 at scaffold): `init_pool`,
`init_window`, `setup_dca_position`, `commit_intent`,
`trigger_aggregate`, `execute_swap`, `claim_allocation`,
`mark_window_failed`, `refund_intent`, `close_intent`.

### Refund flow validated on-chain

End-to-end test on devnet:
- `trigger_aggregate` ([`67fBCQyG`](https://explorer.solana.com/tx/67fBCQyG33dc3NyXQFhpXEkxCQLEbyjrsk91AQPQUEEQBrehp1iaa8eVuciygpLhRuNB6J5BtXRewsTZnDCytkYb?cluster=devnet)) — Open → Aggregating
- `mark_window_failed` ([`4iNFcw2V`](https://explorer.solana.com/tx/4iNFcw2VtohZZX3MJFpbS3L6M9c8if36QXCfyWFjDsCJA3vquPm8hMrPBJJB2tLiDm1pRZTWdiw5JksRidPqn2ov?cluster=devnet)) — Aggregating → Failed
- `refund_intent` ([`SDrdCnJ3`](https://explorer.solana.com/tx/SDrdCnJ3HBHLqUAUkYmFTkMUBKjoH2BC6eSetZnpGZD2XVpiR1UJaZv5KrrH1671SQWDyudKYJnbfFZCU1Z7q5k?cluster=devnet)) — wallet recovered exact `intent.amount`
- `close_intent` ([`2gzNf6UN`](https://explorer.solana.com/tx/2gzNf6UNUwyBeMLm6d3UScsCJx9SsonBgH4bodMNBdvkuat9nenaFCBsjKPdpMYLLaqDcNLYeEQdXGQtb8YpsS8C?cluster=devnet)) — Intent rent reclaimed (~0.0018 SOL)

### Frontend — new routes + components

- `/demo` — interactive auto-cycle walkthrough page (`app/demo/page.tsx`)
- `<NetworkBanner />` — auto-warns when low SOL on devnet
- `<ErrorBoundary />` — branded fallback for any render crash
- `<ArciumProbeCard />` — clickable RescueCipher demo on `/admin`
- `<MoonPayStatusCard />` — live MoonPay `/v3/currencies` data
- Authority-gate banner on `/admin` (read-only view when not pool authority)
- "Reclaim rent" CTA on `/dashboard` post-claim/refund
- Refund banner on `/dashboard` for Failed windows
- "Mint test USDC" CTA on `/setup` for devnet visitors with 0 USDC
- Success state on `/setup` with explorer link + "View dashboard" CTA

### Wallet UX hardenings

- **24h session TTL** on both wallet-adapter AND Privy (sliding window)
- **Two-step disconnect** with 3s auto-revert (prevents fat-finger logout)
- **Network warning banner** detecting cluster mismatch
- **Phantom + Wallet Standard** explicit fallback registration
- **Mode-aware Arcium copy** ("Commitment-fallback mode" when MXE unconfigured)
- **NaN-input guard** on DCA setup form (was silent-fail before)

### Quality / observability

- **12 → 13 sponsor QA cases** in `scripts/qa-sponsors.mjs` — all pass on prod
- **GitHub Actions CI** wired (TypeScript + Rust + sponsor QA jobs)
- **Vercel Cron Job** at `/api/keeper/tick` — serverless seed-loop
  replacement (5-min intervals)
- **Vercel Analytics** wired in `app/layout.tsx`
- **CI badge** in README
- 3 dedicated end-to-end test scripts (`test-refund-flow.mjs`,
  `test-close-intent.mjs`, `test-fail-window.mjs`)
- `tests/README.md` documenting 3-layer test strategy

### Documentation

- **`INTEGRITY.md`** — public self-audit listing all 6 mocked/hardcoded
  items + 4 env-gated components. Reviewer-verifiable bash commands.
- **`.research/honest-depth.md`** — per-sponsor depth audit refreshed
  with post-upgrade state
- **`.research/colosseum-submission.md`** — field bank refresh for the
  submission form
- **`.research/loom-script.md`** — Loom narration refreshed with 10-ix
  state + refund-flow proof
- **`.research/launch-thread.md`** — 10-tweet thread refreshed
- **README** — 10-instruction table + 3 refund-flow tx links + audit
  badge metrics

### Tooling cleanup

- Removed stale `.research/qa-comprehensive.md` + `qa-results.md`
- Removed leftover `scripts/check-balance.mjs` debug script
- Regenerated `package-lock.json` after `@arcium-hq/client@0.9.x` deps
  drift caught by CI's strict `npm ci`
- Added `@vercel/analytics` dependency
- npm scripts: `qa:sponsors`, `qa:e2e`, `seed:loop`, `test:refund-flow`,
  `test:close-intent`

---

## 2026-05-10 — Mid-week hardening (Rounds 4–6)

- Arcium real `@arcium-hq/client` v0.9 SDK integrated with
  RescueCipher + x25519 ECDH code path (`lib/arcium.ts`)
- MoonPay 3 routes shipped (`sign`, `currencies`, `webhook`)
- React error boundary
- Privy 24h TTL parity
- Two-step disconnect logic
- Network warning banner with cluster mismatch detection
- Phantom adapter fix (Wallet Standard explicit fallback)

---

## 2026-05-09 — Scaffold + initial sponsor integrations

- Scaffolded via `/scaffold-project` skill
- Anchor program with original 7 instructions deployed to devnet at
  `HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg`
- 9 sponsor integrations wired (initial depths 2/4–3/4)
- `/setup`, `/dashboard`, `/admin` user flows shipped
- Initial `qa-sponsors.mjs` with 7 cases
- Test SPL USDC mint deployed (`BKQ9HAzw...`) for region-blocked devnet users
- Pinned 7-tx lifecycle validation as pinned README references

---

## Numbers at submission

| Metric | Value |
|---|---|
| Anchor instructions | 10 |
| Anchor upgrades on devnet | 7 successful |
| Audit findings closed in code | 5 of 5 |
| Sponsor integrations | 9 |
| Automated QA cases | 13 (was 7) |
| Routes | 6 (`/`, `/demo`, `/setup`, `/dashboard`, `/admin`, `/api/*`) |
| GitHub Actions CI jobs | 3 (TypeScript + Rust + sponsor probes) |
| End-to-end test scripts | 3 (refund-flow, close-intent, fail-window) |
| Pinned lifecycle txs | 7 in README |
| Pinned refund-flow validation txs | 3 + close_intent in README |
| Total session commits | 30+ |
| Wallet UX hardenings | 5+ |
| Documentation files | 12+ |

---

## Roadmap (post-submission)

| Item | Effort | Why |
|---|---|---|
| Arcium MXE deploy | 30-60 min on Linux/Mac | Activates real MPC encryption path |
| MoonPay merchant approval + API key | ~10 min after approval | Activates onramp button |
| Privy origin whitelist for tide-dca.vercel.app | 5 min | Activates email/social login |
| Reflect mainnet ABI integration | 30-60 min when Reflect ships docs | Activates real yield deposit |
| Ottersec / Halborn audit | 2-4 weeks, $15-30K | Mainnet gating |
| Mainnet deployment | Post-audit | Production launch |
| Cross-pair pools (JUP, JTO) | 1-2 weeks | Expand beyond USDC→SOL |
| Cross-chain MEV protection | TBD | Wormhole integration exploration |
