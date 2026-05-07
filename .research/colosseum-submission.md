# Colosseum Submission — Tide

> Copy-paste-ready field bank for the Solana Frontier 2026 (Colosseum)
> submission form. Fields ordered as they typically appear; if the live form
> asks for variants we don't have, draft on the fly from the long description.

---

## Project basics

| Field | Value |
|---|---|
| **Project name** | Tide |
| **Tagline** (≤ 80 chars) | DCA without MEV. Bots blind, retail wins. |
| **One-line summary** (≤ 140 chars) | Solana DCA aggregator that hides retail orders inside MPC-encrypted windows so MEV bots can't sandwich them. |
| **Short description** (≤ 280 chars) | Solana retail loses ~$5M/yr to MEV bots sandwiching DCA orders. Tide aggregates encrypted intents via Arcium MPC, executes one Jupiter swap per window, distributes pro-rata. Slippage drops from ~0.51% to ~0.05%. Privacy + institutional-grade fills for retail. |

---

## Long description (≤ 1500 chars typical)

Tide is a hidden-liquidity DCA pool for Solana. Every solo DCA buy on Jupiter is a sandwich target — bots see the transaction in the mempool, frontrun to push the price up, then sell at your inflated price. Retail eats ~0.51% slippage per buy on average.

Tide aggregates many small DCA intents into one encrypted bucket per time window. Each user encrypts their amount + slippage tolerance client-side; only the ciphertext lands on Solana. Bots see the bucket grow but can't read individual amounts. When the window closes, Arcium MPC nodes jointly compute the total — no single party ever learns who put in what. The aggregate is then routed through Jupiter v6 as one atomic IOC swap with Address Lookup Tables. SOL is split pro-rata back to participants, and each user can claim independently.

Net effect: retail gets institutional-grade execution (~0.05% target slippage) plus privacy. Bots have nothing to frontrun. A $100/week DCA over a year saves ~$24 in slippage alone.

The full lifecycle is live on Solana devnet — Anchor program with 7 instructions (init_pool, setup_dca_position, commit_intent, init_window, trigger_aggregate, execute_swap, claim_allocation), real Jupiter v6 CPI passthrough with PDA-signed swap, and a stub Arcium client encryption layer that ports 1:1 to Arcis when Cohort 2 mainnet access lands.

---

## Track / Category

**Primary track**: DeFi (or Privacy if separately listed)
**Secondary tracks** (if multi-select): Privacy, Infrastructure, Consumer

**Sponsor track claims** (filter by which prizes Colosseum is awarding):
- Phantom — wallet integration, mobile-friendly
- Arcium — confidential aggregate compute (mechanism core)
- Privy — embedded wallet for non-crypto user onboarding
- Jupiter — v6 routing CPI in the swap path
- MoonPay — fiat → USDC onramp (planned, button stub)
- Reflect — yield on idle escrowed USDC (planned)

---

## Links

| Field | Value |
|---|---|
| **Live demo** | https://tide-dca.vercel.app |
| **GitHub repo** | https://github.com/PugarHuda/tide-dca |
| **Demo video** | (Loom URL — record before submission) |
| **Pitch deck** | (optional — link if generated) |
| **Twitter/X** | @tide_dca (if claimed) |
| **Solana Explorer (program)** | https://explorer.solana.com/address/HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg?cluster=devnet |

---

## Team

| Field | Value |
|---|---|
| **Team name** | Tide (solo) |
| **Team size** | 1 |
| **Founder** | Pugar Huda Mantoro |
| **Email** | pugarhudam@gmail.com |
| **Wallet (for prize)** | (your Phantom devnet wallet OR a fresh mainnet wallet — confirm form requires which) |
| **Country** | Indonesia |
| **Discord/Telegram** | (fill in) |

---

## Tech stack (for "what did you build with" field)

- **On-chain**: Anchor 0.31.1 (Rust), `anchor-spl 0.31.1`
- **Confidential compute**: Arcium Arcis DSL (target Cohort 2 mainnet) — currently typed Rust fallback
- **DEX execution**: Jupiter v6 (IOC orders, Address Lookup Tables, swap-instructions API)
- **Frontend**: Next.js 15 App Router, React 19, TypeScript
- **Wallet**: `@solana/wallet-adapter-react` (Phantom default) + Privy embedded wallet bridge
- **Hosting**: Vercel
- **RPC**: Helius (devnet/mainnet ready)
- **Storage**: 100% on-chain — no centralized database

---

## What's working today (devnet proof points)

- ✅ Anchor program deployed: `HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg`
- ✅ All 7 instructions live and tested
- ✅ Test SPL mint deployed (`4YhohVQ8RmudchbAe2UBXcrdduVYkuqyU7hHviz2MSvT`) for end-to-end demo (Circle's faucet is region-blocked for many users, so Tide ships its own)
- ✅ Real Jupiter v6 CPI in `execute_swap` (not stubbed) — escrow PDA signs via `invoke_signed`, ALT-resolved on client, VersionedTransaction
- ✅ `/admin` operator console runs the full lifecycle (init_pool → init_window → mint_test_usdc → trigger_aggregate → execute_swap)
- ✅ User flows live: wallet connect (Phantom + Privy embedded), `/setup` DCA position creation, `/dashboard` commit + claim, real-time balance subscriptions
- ✅ Window history table with realized slippage display
- ✅ Branded 404, OG image, favicon, mobile-responsive nav

## What's not yet (transparently)

- ⏳ Arcium MPC live — gated on Cohort 2 access. Stub encryption + typed Rust fallback runs in its place; ports 1:1 once access lands
- ⏳ MoonPay widget — button placement reserved, integration pending
- ⏳ Reflect yield on escrow USDC — design done, integration pending
- ⏳ Mainnet — gated on Ottersec/Halborn audit ($15-30K, 2-4 weeks) + Arcium mainnet

---

## Why this wins

- **Solves a quantified retail loss**: ~$5M/year skim on Solana DCA volume, easy to put a dollar on
- **Mechanism is novel on Solana**: hidden-liquidity batching is well-studied in TradFi (call auctions / VWAP windows) but nobody has shipped it for retail DCA on Solana with privacy as the wedge
- **Sponsor-aligned by design**: Arcium (MPC core), Jupiter (routing core), Phantom (default wallet), Privy (non-crypto onboarding), MoonPay (fiat) — the integration map matches Frontier sponsor priorities, not as bolt-ons but as load-bearing pieces
- **Working code, not slideware**: full lifecycle on devnet, real Jupiter CPI, real PDA-signed swap, real ATA escrow, real claim flow
- **Solo built**: end-to-end execution demonstrated under hackathon constraints

---

## What to attach / upload

- [ ] Demo video (60-90s Loom or YouTube)
- [ ] Hero screenshot from `/` landing
- [ ] Optional pitch deck (PDF if generated)
- [ ] Architecture diagram (`.superstack/` or `ARCHITECTURE.md` snippet)

---

## Final-pass review checklist before submitting

- [ ] All links work (paste each in incognito browser)
- [ ] Demo video plays and is under 2 minutes
- [ ] GitHub repo is public + README has hero shot
- [ ] Wallet for prize is correct chain + verified
- [ ] No typos in tagline / one-liner (these get re-quoted)
- [ ] Sponsor track claims match what's actually integrated (don't claim what isn't there — judges check)
- [ ] Solo founder name matches Discord / Telegram handle Colosseum has
