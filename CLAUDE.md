# Tide — Hidden-Liquidity DCA Pool

> **DCA without MEV. Bots blind, retail wins.**

Solana retail loses ~$5M/year to MEV bots sandwiching their DCA orders. Tide aggregates encrypted intents via Arcium MPC, executes single atomic swap via Jupiter IOC, distributes pro-rata. Retail gets institutional-grade fills + privacy.

Hackathon target: **Solana Frontier 2026 (Colosseum)**. Submission deadline 2026-05-11.

## Quick Start

```bash
# Install deps (workspace root)
npm install

# Setup wallet + RPC
solana-keygen new --outfile $HOME/.config/solana/id.json
solana config set --url devnet
solana airdrop 2

# Build + deploy Anchor program
anchor build
anchor keys list                  # copy program ID → Anchor.toml + .env.local
anchor build                      # rebuild dengan correct ID
anchor deploy

# Frontend dev
cp .env.example .env.local        # fill API keys
npm run dev                       # → http://localhost:3000

# Run program tests
anchor test
```

## Stack

| Layer | Tech |
|---|---|
| **On-chain program** | Anchor (Rust) — `programs/tide/` |
| **Confidential compute** | Arcium Arcis DSL — `confidential-ixs/` |
| **Frontend** | Next.js 15 App Router + Tailwind + shadcn/ui — `app/` |
| **Wallet** | `@solana/wallet-adapter-react` (Phantom default) + Privy embedded |
| **DEX execution** | Jupiter SDK (IOC orders) |
| **Oracle** | Pyth (window pricing snapshot) |
| **RPC** | Helius (devnet/mainnet) |
| **Storage** | All on-chain — no centralized DB |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Frontend (Next.js)                                       │
│  /              landing + how-it-works                   │
│  /setup         DCA setup wizard                         │
│  /dashboard     savings tracker + window status          │
└──────────────────────────────────────────────────────────┘
       ↕  @solana/wallet-adapter-react
┌──────────────────────────────────────────────────────────┐
│ Anchor Program (programs/tide/)                          │
│  - Pool config + Window lifecycle                        │
│  - DcaPosition (recurring setup)                         │
│  - Intent commit (encrypted hash + amount in escrow)     │
│  - Aggregate trigger (permissionless)                    │
│  - Execute swap via Jupiter CPI                          │
│  - Pro-rata distribution + claim                         │
└──────────────────────────────────────────────────────────┘
       ↕ Arcium MXE network
┌──────────────────────────────────────────────────────────┐
│ Arcis Confidential Functions (confidential-ixs/)         │
│  - aggregate_intents(encrypted[]) → public total + count│
│  - compute_distribution → encrypted allocations          │
└──────────────────────────────────────────────────────────┘
       ↕
┌──────────────────────────────────────────────────────────┐
│ Jupiter IOC + Pyth oracle                                │
│  - Atomic swap execution (no MEV)                        │
│  - Window-time price reference                           │
└──────────────────────────────────────────────────────────┘
```

## Project Layout

```
tide/
├── app/                      Next.js App Router
│   ├── layout.tsx           Root layout (wallet providers)
│   ├── page.tsx             Landing
│   ├── setup/page.tsx       DCA setup wizard
│   ├── dashboard/page.tsx   User dashboard
│   ├── api/                 (TBD: oracle proxy, indexer)
│   └── globals.css
├── programs/tide/            Anchor program
│   └── src/
│       ├── lib.rs           Program entry + 6 instructions
│       ├── state.rs         Pool, DcaPosition, Window, Intent
│       ├── error.rs         Custom errors
│       └── instructions/    Per-instruction handlers
├── confidential-ixs/         Arcium MXE
│   └── src/lib.rs           aggregate_intents + compute_distribution
├── lib/                      Shared TS utilities
│   ├── constants.ts
│   ├── types.ts
│   ├── providers.tsx
│   └── utils.ts
├── components/               React components
│   ├── nav.tsx
│   ├── connect-button.tsx
│   └── dca-setup-form.tsx
├── tests/                    Anchor tests (LiteSVM + Surfpool)
├── .superstack/
│   ├── idea-context.md       Phase 1 handoff
│   └── build-context.md      Phase 2 handoff
├── .research/                Sponsor + judge intelligence
├── .claude/settings.json     MCP config
├── Anchor.toml
├── package.json
├── .env.example
└── CLAUDE.md (this file)
```

## Conventions

### Naming
- **Anchor accounts**: `Pool`, `DcaPosition`, `Window`, `Intent`
- **Instructions**: `init_pool`, `setup_dca_position`, `commit_intent`, `trigger_aggregate`, `execute_swap`, `claim_allocation`
- **PDA seeds**: `b"pool"`, `b"dca-position"`, `b"window"`, `b"intent"`, `b"escrow"`

### Code style
- **Anchor**: idiomatic Rust, `#[derive(Accounts)]` for instruction contexts
- **Frontend**: Server Components default, `'use client'` only for wallet/interactive
- **Arcis**: confidential functions use masked types (`mu64`, `mbool`)

### Brand
- **Codename**: Tide
- **Domain**: tide.fun (target)
- **Twitter**: @tide_dca
- **Color**: cyan (`#06b6d4`) on zinc-950
- **Tone**: precise, financial, slight ocean metaphor (flow, currents, tide)

## Sponsor Integration

| Sponsor | Role | Files |
|---|---|---|
| **Arcium** | Encrypted intent + aggregate compute (mechanism core) | `confidential-ixs/src/lib.rs` |
| **Phantom** | Default wallet + grand prize sponsor | `lib/providers.tsx` |
| **Privy** | Non-crypto user onboarding | `lib/providers.tsx`, `lib/privy-bridge.tsx`, `app/api/privy/verify/route.ts` |
| **MoonPay** | Fiat → USDC direct top-up | `lib/moonpay.ts`, `components/moonpay-button.tsx`, `app/api/moonpay/sign/route.ts` |
| **Reflect** | Yield on idle escrow USDC | `lib/reflect.ts`, `components/reflect-card.tsx`, `components/reflect-stake-button.tsx` |
| **Raydium** | DEX backbone routing | `lib/raydium.ts`, `components/raydium-quote-card.tsx` |
| **Pyth** | Window-time SOL/USD oracle | `lib/pyth.ts`, `components/pyth-oracle-card.tsx` |
| **Squads/Altitude** | Pool authority multisig path | `lib/squads.ts`, `components/squads-create-button.tsx`, `lib/hooks/use-authority-class.ts` |

## Build Status

- [x] Idea phase complete (`.superstack/idea-context.md`)
- [x] Scaffold complete (`.superstack/build-context.md`)
- [x] Anchor program: 7 instructions live + tested on devnet
- [x] Arcis confidential function: skeleton + intent hash on-chain (Cohort 2 mainnet target)
- [x] Frontend: wallet connect (Phantom + Privy), setup wizard, dashboard, admin console
- [x] Jupiter v6 CPI: real PDA-signed swap via execute_swap (devnet validated)
- [x] Full E2E lifecycle: 7 of 7 instructions validated on devnet
- [x] 9 sponsor integrations shipped (Phantom, Jupiter, Privy, Squads, Raydium, MoonPay, Pyth, Reflect, Arcium)
- [ ] Demo Loom recorded
- [ ] Submission to Colosseum (deadline 2026-05-11)

## Claude Code Working Notes

### When implementing Anchor instructions:
1. Each instruction in own file under `programs/tide/src/instructions/`
2. Re-export in `instructions/mod.rs`
3. Add handler call in `programs/tide/src/lib.rs`
4. Generate IDL via `anchor build`

### When integrating Jupiter:
1. Use `@jup-ag/api` for quote fetching client-side
2. Call Jupiter Swap CPI from Anchor program (passing route data)
3. Use IOC (immediate-or-cancel) flag to prevent partial fills
4. Optionally bundle via Jito for atomic block inclusion

### When integrating Arcium:
1. Apply to Cohort 2 Private Testnet at arcium.com/build
2. Use `@arcium/client` browser SDK for encryption
3. Deploy Arcis function via `arcium deploy`
4. CPI call from Anchor program triggers MXE compute
5. Result returned via callback instruction

### When adding frontend pages:
1. Create folder in `app/`
2. Server Components by default
3. `'use client'` only for wallet/state hooks

## Risk Awareness

See `.superstack/idea-context.md` Section 5 for full risk register. Key:
- Arcium MPC latency (validate Day 1-3)
- Cold start liquidity ($10K bootstrap)
- Smart contract risk (audit + caps)

## Build Diary

Track major decisions di file ini sebagai building. Update tiap milestone.

---

*Generated from `/scaffold-project` skill (solana.new). See `.superstack/idea-context.md` for full project context.*
