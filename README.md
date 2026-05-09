# 🌊 Tide

> **DCA without MEV. Bots blind, retail wins.**

[**Live demo**](https://tide-dca.vercel.app) · **Demo video** · [Devnet program](https://explorer.solana.com/address/HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg?cluster=devnet)

[![Solana](https://img.shields.io/badge/Solana-Frontier_2026-9945FF)](https://colosseum.com/frontier)
[![Arcium](https://img.shields.io/badge/Arcium-MPC_Cohort_2-06b6d4)](https://arcium.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blue)](https://www.anchor-lang.com)
[![Status](https://img.shields.io/badge/devnet-validated_7%2F7-22c55e)](#what-works-today)

---

## The problem

Solana retail loses **~$5M/year** to MEV bots sandwiching their DCA orders.

Every solo DCA buy is a sandwich target. Bot sees your tx hit the mempool,
frontruns to push the price up, sells at your inflated price. You eat the
spread — typically **~0.51% per buy**, ~$24/year on a $100/week DCA.

## How Tide fixes it

```
┌─ Many depositors ─┐    ┌─ Arcium MPC ─┐    ┌─ Jupiter v6 ─┐    ┌─ Pro-rata ─┐
│ encrypted intents │ →  │  aggregate Σ │ →  │ atomic swap   │ →  │  payout    │
│ (amounts hidden)  │    │  (no leak)   │    │ (IOC, ALT)    │    │ each user  │
└───────────────────┘    └──────────────┘    └───────────────┘    └────────────┘
```

1. **You drop in** — USDC + intent encrypted client-side, only ciphertext lands on Solana
2. **The tide rises** — every depositor in this window joins one encrypted bucket
3. **MPC aggregates** — Arcium nodes jointly compute the total, no single party sees individuals
4. **One swap, blind** — aggregate routes through Jupiter as a single tx, bots can't isolate anyone

Net effect: slippage **~0.51% solo → ~0.05% pooled**. Retail gets institutional-grade execution + privacy.

## What works today

Full lifecycle validated end-to-end on Solana **devnet**:

| Step | Tx |
|---|---|
| init_pool (15-min window, 0.05% fee) | [`5NV9QA94...`](https://explorer.solana.com/tx/5NV9QA94Jqa9XWtyZ8RG8Hn4gjXedH2fQ9DfNFrePdeo2uL1mnnk3hekEYpeeio7xRe1dJpTADkG6rowMFRjq5g5?cluster=devnet) |
| init_window | [`45ZefYtv...`](https://explorer.solana.com/tx/45ZefYtvf2UX49LpomDQ9GeQ4q161CdWXRSXW5pqwaiqMLW8yid1qgeKPSQi5MmqmEFfbmCak6FurjpLHXjdfRCs?cluster=devnet) |
| setup_dca_position | [`5vuVCW14...`](https://explorer.solana.com/tx/5vuVCW14E29Bwv53X7kBtaUH7jypVBCbhZsiAzAtTPeDJacg6facoQPxwZ8hNeELhDW769knScc3yzDNC3z5RcC3?cluster=devnet) |
| commit_intent ($10 USDC) | [`3yCk2Gmo...`](https://explorer.solana.com/tx/3yCk2Gmo4t9MQRp7vXmY3Gy7bjmhsG8ufbjSc4t12Rd1kVqQjavDK8rfmG5nFC8Tz81YeUxje934hwCVAWQB13gk?cluster=devnet) |
| trigger_aggregate | [`23EBNTuu...`](https://explorer.solana.com/tx/23EBNTuu64jntJe13LJNTfH2BWf12Q1PWgccXae5bWVC5LsaPv5KVrw2Q56gb6q3wrVKHp5UH3mjxaKpU1XSQPaF?cluster=devnet) |
| execute_swap (PDA-signed CPI) | [`2yCSusUk...`](https://explorer.solana.com/tx/2yCSusUkWNS59y1ypX38AB5c1rN7NG4DwwS5Q4G6yY91eVqcuXA5Fp9JUY2NKxN964Ldtr3QLFHyb2mD8Ji81Bu7?cluster=devnet) |
| claim_allocation (0.01 wSOL out) | [`5DU1YMSf...`](https://explorer.solana.com/tx/5DU1YMSfPVkSEpqw1xenu6GjaBtUTK1m242DNThzURfq5MagKkSivj17LaJ82aahdk2CsppG3SH4RBZ2cZS7fmiT?cluster=devnet) |

7 of 7 instructions validated. Full report: [`.research/qa-results.md`](./.research/qa-results.md).

## Sponsor integrations

| Sponsor | Depth | Evidence |
|---|---|---|
| **Phantom** | 4/4 Deep | Default wallet, custom modal, mobile drawer, balance subs · `components/connect-button.tsx` |
| **Jupiter** | 4/4 Deep | v6 quote + swap-instructions + ALT + PDA-signed CPI · `lib/jupiter.ts`, devnet tx `2yCSusUk...` |
| **Privy** | 4/4 Deep | Embedded wallet bridge + `/api/privy/verify` JWT round-trip · `lib/privy-bridge.tsx` |
| **Squads / Altitude** | 3.5/4 Solid+ | `multisig_create_v2` ix builder + Authority-type detection · `lib/squads.ts` |
| **Raydium** | 3/4 Solid | V3 trade API + AMM v4/CLMM program ids · `lib/raydium.ts` + live `/admin` quote preview |
| **MoonPay** | 3/4 Solid | URL builder + HMAC-SHA256 server signing · `app/api/moonpay/sign/route.ts` |
| **Pyth** | 3/4 Solid | V2 price account decoded inline + live oracle card · `lib/pyth.ts` |
| **Reflect** | 3/4 Solid | Yield estimator + deposit ix builder + admin stake button · `lib/reflect.ts` |
| **Arcium** | 3/4 Solid | `@arcium-hq/client` v0.9 installed + real `RescueCipher` + `x25519` ECDH path in `lib/arcium.ts`, SHA-256 commitment fallback for devnet; `confidential-ixs/` Rust skeleton ready for `arcium build` |

Full audit: [`.research/sponsor-evidence.md`](./.research/sponsor-evidence.md).

## Quick start

```bash
# 1. Install
npm install

# 2. Solana wallet on devnet
solana-keygen new --outfile $HOME/.config/solana/id.json
solana config set --url devnet
solana airdrop 2

# 3. Env config — copy + fill keys (Helius, Privy, MoonPay)
cp .env.example .env.local

# 4. Anchor program (already deployed at HanBZ74Q...)
#    Skip if just running the frontend
anchor build && anchor keys list   # → Anchor.toml + .env.local
anchor build && anchor deploy

# 5. Run
npm run dev    # → http://localhost:3000
```

## Repo layout

```
tide/
├── app/                    Next.js 15 App Router
│   ├── page.tsx           Landing — predator eyes hero + savings calc
│   ├── setup/             DCA position wizard
│   ├── dashboard/         User KPIs + commit/claim + window history
│   ├── admin/             Operator console — full lifecycle + 5 sponsor probes
│   └── api/               Server routes (moonpay sign, privy verify)
├── programs/tide/          Anchor program — 7 instructions
│   └── src/
│       ├── state.rs       Pool, DcaPosition, Window, Intent
│       ├── instructions/  init_pool, setup_dca, commit, trigger_aggregate, execute_swap, claim
│       └── error.rs
├── confidential-ixs/       Arcium Arcis (Cohort 2 target)
├── components/             React components
│   ├── predator-eyes.tsx  Animated cat-eye background (6-layer flame outlines)
│   └── ...                MoonPayButton, ReflectStakeButton, PythOracleCard, etc.
├── lib/                    Shared utilities
│   ├── tide-actions.ts    On-chain action builders (raw web3.js)
│   ├── jupiter.ts         Jupiter v6 quote + swap-ix
│   ├── raydium.ts         Raydium V3 trade API
│   ├── arcium.ts          Encryption stub (Cohort 2 swap-in ready)
│   ├── pyth.ts            Pyth V2 price account decoder
│   ├── reflect.ts         Reflect deposit ix builder + yield estimator
│   ├── squads.ts          Squads V4 multisig detection + creation
│   └── moonpay.ts         MoonPay onramp URL builder
├── scripts/                Dev tools — qa-smoke.mjs, qa-e2e.mjs, qa-sponsors.mjs
├── tests/                  Anchor LiteSVM + Surfpool tests
├── .research/              Hackathon docs — sponsor-evidence, qa-results, submission
└── .superstack/            Project context (idea, build)
```

## Stack

| Layer | Tech |
|---|---|
| On-chain program | Anchor 0.31.1 (Rust), `anchor-spl 0.31.1` |
| Confidential compute | Arcium Arcis DSL (Cohort 2 target) |
| DEX routing | Jupiter v6 (IOC + ALT + VersionedTx) |
| Frontend | Next.js 15 App Router, React 19, TypeScript |
| Wallet | `@solana/wallet-adapter-react` (Phantom default) + Privy embedded |
| Hosting | Vercel |
| RPC | Helius (devnet/mainnet ready) |
| Storage | 100% on-chain — no DB |

## Status

- [x] Anchor program deployed: `HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg`
- [x] All 7 instructions validated on devnet (full lifecycle)
- [x] Real Jupiter v6 CPI — escrow PDA-signed, Address Lookup Tables resolved
- [x] Custom test SPL mint deployed for region-blocked Circle USDC users
- [x] /admin operator console with 5 sponsor probes (Raydium, Pyth, Privy, Reflect, Squads)
- [x] Frontend live: wallet connect, DCA setup, dashboard, full window history
- [ ] Arcium MPC live — pending Cohort 2 access; typed Rust fallback in place
- [ ] Mainnet — gated on Ottersec/Halborn audit + Arcium mainnet
- [ ] MoonPay production API key — sandbox active, prod swap is one env var

## Documentation

- [`PITCH.md`](./PITCH.md) — narrative pitch
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design
- [`DEMO.md`](./DEMO.md) — demo path / what to show
- [`DEPLOY.md`](./DEPLOY.md) — runbook from build to first DCA
- [`SETUP.md`](./SETUP.md) — local environment setup
- [`ARCIUM.md`](./ARCIUM.md) — confidential compute integration plan
- [`.research/`](./.research) — sponsor evidence + QA reports + submission field bank

## License

MIT — program code + frontend.

## Built solo

By [Pugar Huda Mantoro](https://github.com/PugarHuda) for Solana Frontier 2026 (Colosseum). Solo founder, Claude Code as execution force-multiplier.

Acknowledgments: [Solana Foundation](https://solana.com), [Colosseum](https://colosseum.com), [Arcium](https://arcium.com), [Phantom](https://phantom.app), [Privy](https://privy.io), [Jupiter](https://jup.ag), [Raydium](https://raydium.io), [Pyth](https://pyth.network), [Reflect](https://reflect.app), [Squads](https://squads.so), [MoonPay](https://moonpay.com).
