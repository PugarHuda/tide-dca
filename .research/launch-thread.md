# Tide — Twitter / X launch thread

**Goal**: Build social signal pre-judging. Each tweet ≤ 280 chars.
**Best post time**: 9–11 AM EST (US judge timezone wake-up window) — for Solana audience also overlaps with SEA evening.
**From**: @tide_dca (if claimed) or personal handle. Add `@solana_devs` `@arciumhq` `@phantom` `@privy_io` `@JupiterExchange` to mentions where natural.

> Refreshed 2026-05-11 with current state: 10 instructions, 7 successful
> Anchor upgrades, refund flow validated on-chain.

---

## Tweet 1 — Hook + problem (pin)

> Solana retail loses ~$5M/year to MEV bots sandwiching their DCA orders.
>
> Every solo DCA buy is a sandwich target — bot frontruns, you eat ~0.51% slippage.
>
> Tide makes the bots blind.
>
> 🌊 tide-dca.vercel.app
>
> Built for @solana_devs Frontier 2026.

---

## Tweet 2 — Solution one-liner

> Tide is a hidden-liquidity DCA pool.
>
> Encrypt your buy intent client-side → it joins an anonymous bucket with every other depositor in this window → the whole pool settles as ONE Jupiter swap.
>
> Bots see one transaction. Never your individual order.

---

## Tweet 3 — Architecture screenshot

> Three layers, one mechanism:
>
> 1. Many depositors → encrypted intents
> 2. @arciumhq MPC nodes → joint aggregate, no single party sees individuals
> 3. @JupiterExchange v6 → single atomic IOC swap, pro-rata payout
>
> Slippage drops 0.51% → 0.05% target.

*(attach architecture diagram from ARCHITECTURE.md)*

---

## Tweet 4 — Working code, on-chain proof

> Not slideware. Live on Solana devnet:
>
> ✅ Anchor program with 10 instructions
> ✅ 7 successful on-chain upgrades during submission day
> ✅ Real Jupiter v6 PDA-signed CPI
> ✅ 13-case automated QA passing on prod
>
> Repo: github.com/PugarHuda/tide-dca

---

## Tweet 5 — The refund safety net (unique flex)

> Most DCA products demo only the happy path.
>
> Tide ships the failure escape hatch as a first-class concept:
> - mark_window_failed (operator)
> - refund_intent (user)
> - close_intent (rent recovery)
>
> Full refund flow validated end-to-end on devnet.

---

## Tweet 6 — Audit transparency

> We ran our own audit on submission day and surfaced 5 findings.
>
> All 5 closed in code, 4 deployed on-chain via 7 Anchor upgrades.
>
> Self-audit published at INTEGRITY.md — judges find disclosure first, not surprises.

---

## Tweet 7 — Sponsor depth

> 9 sponsor integrations, all real:
>
> @phantom — 4/4 default wallet + 24h session TTL
> @arciumhq — RescueCipher + x25519 SDK live
> @privy_io — embedded wallet + JWT verify
> @JupiterExchange — v6 PDA-signed CPI on-chain
> @MoonPay — HMAC sign + webhook
> @pyth_network — V2 decode + slippage
> @SquadsLabs — V4 multisig
> @RaydiumProtocol — V3 trade API
> @reflectprotocol — yield estimator

---

## Tweet 8 — Production engineering depth

> Engineering signals that distinguish demo from production-ready:
>
> ✅ 13-case CI matrix (GitHub Actions, green)
> ✅ Self-audit doc (INTEGRITY.md) — every gap publicly disclosed
> ✅ React error boundary + 24h session TTL + 2-step disconnect
> ✅ Vercel Cron keeper (serverless)

---

## Tweet 9 — Interactive walkthrough

> Want to feel the product without connecting?
>
> tide-dca.vercel.app/demo
>
> Auto-cycle through 9 steps. Every step links to a real on-chain
> transaction on devnet. Includes the failure-recovery branch.

---

## Tweet 10 — Solo founder + close

> Built solo. Claude Code as the execution force-multiplier.
>
> From idea → 10 on-chain instructions → INTEGRITY.md → CI green in a
> single hackathon cycle.
>
> 🌊 Tide. DCA without MEV. Bots blind, retail wins.
>
> #SolanaFrontier2026

---

## Optional engagement plays (after main thread lands)

- **Reply-to-self with stats**: "Numbers from this build: 28+ commits, 7 Anchor upgrades, 13 QA cases green. All on a Windows hackathon env. Receipts in the repo."
- **Quote-tweet sponsors**: tag each sponsor (Arcium, Jupiter, Phantom, Privy) with a 1-tweet summary of how Tide uses them
- **Reply to comments with deep links**: when someone asks about a sponsor, link to the corresponding section in INTEGRITY.md or sponsor-evidence.md

---

## Bullet-list version (for shorter / different formats)

If thread feels too long, condense to 4 tweets:

1. (Hook + problem) — same as Tweet 1
2. (Solution + mechanism) — combine Tweets 2 + 3
3. (Working code + audit) — combine Tweets 4 + 6
4. (Refund flow + close) — combine Tweets 5 + 10

---

## Discord / Telegram variant

Drop into Solana-focused channels (where appropriate per channel rules):

> **Tide — DCA without MEV** (Frontier 2026)
>
> Solana retail loses ~$5M/year to MEV bots sandwiching DCA orders.
> Tide makes them blind: encrypted intents aggregate into one Jupiter swap
> per window. Slippage 0.51% → 0.05%. Privacy by design.
>
> Built solo. 10 Anchor instructions, 7 successful on-chain upgrades,
> 13 QA cases green, self-audit published. Refund flow tested
> end-to-end on devnet.
>
> Live: tide-dca.vercel.app
> Code: github.com/PugarHuda/tide-dca
> Walkthrough: tide-dca.vercel.app/demo

---

## Hashtags (use 2-3 max per tweet to avoid spam look)

- `#SolanaFrontier2026`
- `#SolanaSummer` (if active)
- `#DCA` `#MEV` (DeFi-aware audience)
- `#Arcium` `#MPC` `#PrivacyDeFi`
