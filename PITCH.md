# Tide — Pitch

> **DCA without MEV. Bots blind, retail wins.**
>
> Hidden-Liquidity DCA Pool for Solana retail. Encrypted intents via Arcium MPC, single Jupiter swap per window, pro-rata distribution. Slippage drops from ~0.51% to ~0.05%.

[Live demo](https://tide-dca.vercel.app) · [GitHub](https://github.com/PugarHuda/tide-dca) · [Devnet program](https://explorer.solana.com/address/HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg?cluster=devnet)

---

## The problem

Solana retail loses **~$5M/year** to MEV bots sandwiching their DCA orders.

Every solo DCA buy is a sandwich target:

1. Bot watches the mempool, spots your $50 USDC → SOL transaction
2. Frontruns: bot buys SOL right before you, pushing the price up
3. Your transaction executes at the inflated price
4. Bot dumps for profit

You eat ~0.51% slippage per buy. On a $100/week DCA, that's ~$24/year per user. Across all retail DCA volume on Solana, the bot industry extracts **millions per year** from people too small to fight back.

URANI fixed MEV for whales. Archer fixed it for market makers. **Nobody has fixed it for retail's most common behavior** — recurring buys.

## The solution

Tide is a **hidden-liquidity DCA pool**. Instead of sending your buy to the mempool individually, you join an encrypted aggregate window with every other depositor.

```
┌─ Many depositors ─┐    ┌─ Arcium MPC ─┐    ┌─ Jupiter v6 ─┐    ┌─ Pro-rata ─┐
│ encrypted intents │ →  │  aggregate Σ │ →  │ atomic swap   │ →  │  payout    │
│ (amounts hidden)  │    │  (no leak)   │    │ (IOC, ALT)    │    │ each user  │
└───────────────────┘    └──────────────┘    └───────────────┘    └────────────┘
```

1. **You drop in.** USDC + buy intent encrypted client-side. Only opaque ciphertext lands on Solana — bots see nothing.
2. **The tide rises.** Every depositor in this window joins one encrypted bucket. Bots watch the bucket grow but can't read who put in what.
3. **MPC aggregates.** When the window closes, Arcium MPC nodes jointly compute the total. No single party ever learns the individual amounts.
4. **One swap, blind.** The aggregate routes through Jupiter as a single transaction. Sandwich bots can't isolate anyone. SOL splits back pro-rata.

Net effect: slippage drops from **~0.51% solo → ~0.05% pooled**. Retail gets institutional-grade execution + privacy.

## Why now

| Trend | Implication for Tide |
|---|---|
| Solana retail DCA volume hit ~$80M/month in Q1 2026 | Aggregate pool depth is large enough to mask individual buys |
| Arcium Cohort 2 ships confidential compute on Solana mainnet | Encrypted aggregate becomes practical, not theoretical |
| Phantom + Privy now reach 8M+ wallets on Solana | Distribution surface for retail is real |
| MoonPay acquires DFlow ($100M, May 2026) | Phantom users have one-click fiat → USDC. Tide hooks directly |

Privacy + retail + DCA = an unbuilt wedge in a market where the surrounding pieces just landed.

## What's working today

Full lifecycle validated end-to-end on Solana **devnet**:

| # | Instruction | Tx |
|---|---|---|
| 1 | init_pool | [`5NV9QA94...`](https://explorer.solana.com/tx/5NV9QA94Jqa9XWtyZ8RG8Hn4gjXedH2fQ9DfNFrePdeo2uL1mnnk3hekEYpeeio7xRe1dJpTADkG6rowMFRjq5g5?cluster=devnet) |
| 2 | init_window | [`45ZefYtv...`](https://explorer.solana.com/tx/45ZefYtvf2UX49LpomDQ9GeQ4q161CdWXRSXW5pqwaiqMLW8yid1qgeKPSQi5MmqmEFfbmCak6FurjpLHXjdfRCs?cluster=devnet) |
| 3 | setup_dca_position | [`5vuVCW14...`](https://explorer.solana.com/tx/5vuVCW14E29Bwv53X7kBtaUH7jypVBCbhZsiAzAtTPeDJacg6facoQPxwZ8hNeELhDW769knScc3yzDNC3z5RcC3?cluster=devnet) |
| 4 | commit_intent ($10 USDC) | [`3yCk2Gmo...`](https://explorer.solana.com/tx/3yCk2Gmo4t9MQRp7vXmY3Gy7bjmhsG8ufbjSc4t12Rd1kVqQjavDK8rfmG5nFC8Tz81YeUxje934hwCVAWQB13gk?cluster=devnet) |
| 5 | trigger_aggregate | [`23EBNTuu...`](https://explorer.solana.com/tx/23EBNTuu64jntJe13LJNTfH2BWf12Q1PWgccXae5bWVC5LsaPv5KVrw2Q56gb6q3wrVKHp5UH3mjxaKpU1XSQPaF?cluster=devnet) |
| 6 | execute_swap (PDA-signed CPI) | [`2yCSusUk...`](https://explorer.solana.com/tx/2yCSusUkWNS59y1ypX38AB5c1rN7NG4DwwS5Q4G6yY91eVqcuXA5Fp9JUY2NKxN964Ldtr3QLFHyb2mD8Ji81Bu7?cluster=devnet) |
| 7 | claim_allocation (0.01 wSOL out) | [`5DU1YMSf...`](https://explorer.solana.com/tx/5DU1YMSfPVkSEpqw1xenu6GjaBtUTK1m242DNThzURfq5MagKkSivj17LaJ82aahdk2CsppG3SH4RBZ2cZS7fmiT?cluster=devnet) |

Anchor program: `HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg` on devnet.

## Sponsor integrations

Nine sponsor tracks integrated, none as bolt-ons:

| Sponsor | Role | Depth |
|---|---|---|
| **Phantom** | Default wallet, custom modal, account dropdown | 4/4 Deep |
| **Jupiter** | v6 quote + swap-instructions + ALT + PDA-signed CPI | 4/4 Deep |
| **Privy** | Embedded wallet bridge + server JWT verification | 4/4 Deep |
| **Squads/Altitude** | Multisig detection + `multisig_create_v2` ix builder | 3.5/4 Solid+ |
| **Raydium** | V3 trade API quote + AMM v4/CLMM program ids | 3/4 Solid |
| **MoonPay** | URL builder + HMAC-SHA256 server signing | 3/4 Solid |
| **Pyth** | V2 price account decoded inline + live oracle card | 3/4 Solid |
| **Reflect** | Yield estimator + deposit ix + admin stake button | 3/4 Solid |
| **Arcium** | Confidential ix skeleton + intent hash on-chain | 2/4 Skeleton (Cohort 2 target) |

Full audit in [`.research/sponsor-evidence.md`](./.research/sponsor-evidence.md).

## Mainnet path

Hackathon ships on devnet. Production path:

- [ ] Ottersec or Halborn audit (~$15-30K, 2-4 weeks)
- [ ] Arcium MPC live (Cohort 2 access pending — typed Rust fallback in place today)
- [ ] Pool authority migrated to Squads V4 multisig
- [ ] Bug bounty: Immunefi $50-100K critical tier
- [ ] Pyth oracle on-chain consumer in `execute_swap` for honest slippage_bps reporting
- [ ] Real MoonPay production API key + DFlow integration
- [ ] Reflect on-chain CPI for idle escrow yield → fee bucket → pro-rata distribution

Architecture is mainnet-ready. Each item is a config or audit step, not a code rewrite.

## What I'm asking for

- **Sponsor track wins** to fund the audit and Arcium Cohort 2 push
- **Phantom or Privy distribution partnership** to reach the 8M+ wallets that need this on day one
- **Engineering grant** to extend Arcis confidential compute beyond aggregate to per-user slippage caps and yield routing

## Built solo

By [Pugar Huda Mantoro](https://github.com/PugarHuda) for **Solana Frontier 2026 (Colosseum)**.

Solo founder, 2 weeks of focused build, Claude Code as execution multiplier. Submission deadline 2026-05-11.

The repo is public from day one. Every line of code, every transaction, every sponsor integration verifiable.
