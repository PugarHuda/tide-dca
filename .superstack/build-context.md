# Build Context — Phase 2 Handoff (Build → Implementation)

> **Project**: Tide — Hidden-Liquidity DCA Pool
> **Date scaffolded**: 2026-05-02
> **Phase**: 2 (Build) — scaffold complete, MVP implementation pending

---

## Stack Decisions (locked)

### Architecture Pattern
**Pattern 1: Next.js + Anchor dApp** (extended dengan Arcium MXE) per scaffold-project decision tree.

Rationale:
- Custom on-chain logic required (pool, window lifecycle, distribution)
- Custom confidential compute required (Arcium aggregate_intents + compute_distribution)
- Frontend essential (DCA setup wizard, savings dashboard)
- Cannot satisfy via integration-only

### Skills installed (from solana-new catalog)
- ⏳ `programs-anchor` (official) — *to install via `npx skills add`*
- ⏳ `frontend-framework-kit` (official)
- ⏳ `pyth-skill`
- ⏳ `testing` (official)
- ⏳ `security` (official)

### MCPs configured
- ✅ `helius-mcp` — RPC + DAS API + indexer (`.claude/settings.json`)
- (Phantom MCP — not needed for Tide; subscribers use Wallet Standard, no AI agent layer)

### Repos referenced (manual scaffold per Arcium custom needs)
- create-solana-dapp templates (consulted for Next.js + Anchor structure)
- anchor-by-example (consulted for instruction patterns)
- Arcium Arcis docs (manual scaffold per docs spec)

---

## Sponsor Stack (5 core, all justified)

| Sponsor | Integration depth | Files |
|---|---|---|
| **Arcium** | Encrypted intent storage + aggregate compute (mechanism core) | `confidential-ixs/src/lib.rs` |
| **Phantom** | Default wallet via Wallet Standard + grand prize sponsor | `lib/providers.tsx` |
| **Privy** | Embedded wallet for non-crypto user onboarding | TODO `lib/privy.tsx` |
| **MoonPay** | Fiat → USDC direct top-up to pool | TODO `lib/moonpay.ts` |
| **Reflect** | Yield-bearing on idle escrow USDC (Phase 2 enhancement) | TODO `lib/reflect.ts` |
| Jupiter (auxiliary) | DEX execution backend (IOC orders) | TODO `lib/jupiter.ts` |
| Pyth (auxiliary) | Window pricing snapshot | `programs/tide/src/instructions/execute_swap.rs` |

---

## Project Layout (created)

```
F:/Hackathons/Hackathon Frontier/
├── app/                              [Next.js 15 App Router]
│   ├── layout.tsx                    ✅ root layout (Wallet provider wrapped)
│   ├── page.tsx                      ✅ landing — hero, stats, how-it-works
│   ├── globals.css                   ✅ Tailwind base + cyan accent
│   ├── setup/page.tsx                ✅ DCA setup wizard
│   ├── dashboard/page.tsx            ✅ user dashboard with savings tracker
│   └── api/                          ⏳ TBD (oracle proxy, indexer endpoints)
├── programs/tide/                    [Anchor program]
│   ├── Cargo.toml                    ✅
│   └── src/
│       ├── lib.rs                    ✅ entry + 6 instructions declared
│       ├── state.rs                  ✅ Pool, DcaPosition, Window, Intent
│       ├── error.rs                  ✅ 18 custom error codes
│       └── instructions/
│           ├── mod.rs                ✅
│           ├── init_pool.rs          ✅ admin pool config
│           ├── setup_dca_position.rs ✅ user DCA position
│           ├── commit_intent.rs      ✅ encrypted intent + escrow
│           ├── trigger_aggregate.rs  ✅ permissionless trigger
│           ├── execute_swap.rs       ✅ Jupiter IOC stub
│           └── claim_allocation.rs   ✅ pro-rata distribution claim
├── confidential-ixs/                 [Arcium MXE]
│   ├── Cargo.toml                    ✅
│   └── src/lib.rs                    ✅ aggregate_intents + compute_distribution + tests
├── lib/                              [Shared TS]
│   ├── constants.ts                  ✅ program IDs, mints, seeds, network config
│   ├── utils.ts                      ✅ formatting helpers (USDC, SOL, BPS, time)
│   ├── providers.tsx                 ✅ Solana ConnectionProvider + WalletProvider
│   └── types.ts                      ✅ Pool, DcaPosition, Window, Intent types
├── components/                       [React components]
│   ├── nav.tsx                       ✅ top navigation
│   ├── connect-button.tsx            ✅ wallet connect
│   └── dca-setup-form.tsx            ✅ DCA setup wizard form
├── tests/                            ⏳ to implement (LiteSVM + Surfpool)
├── migrations/                       ⏳ to implement
├── .superstack/
│   ├── idea-context.md               ✅ (Phase 1 handoff)
│   └── build-context.md              ✅ (this file)
├── .research/                        (existing — sponsor/judge intelligence)
├── .claude/
│   └── settings.json                 ✅ Helius MCP configured
├── .env.example                      ✅
├── .gitignore                        ✅
├── Anchor.toml                       ✅
├── package.json                      ✅
├── tsconfig.json                     ✅
├── next.config.ts                    ✅
├── tailwind.config.ts                ✅
├── postcss.config.js                 ✅
├── README.md                         ✅
└── CLAUDE.md                         ✅
```

---

## Build Status

```json
{
  "phase": "scaffold-complete",
  "scaffold_complete": true,
  "first_compile": false,
  "mvp_complete": false,
  "tests_passing": false,
  "devnet_deployed": false
}
```

---

## Critical Next Steps (Phase 2 Implementation)

### Tier 0 — Setup (~30 min, do first)

1. **Install Node deps**: `npm install`
2. **Install solana-new skills** untuk Claude Code:
   ```bash
   npx skills add solana-foundation/programs-anchor-skill
   npx skills add solana-foundation/frontend-framework-kit
   npx skills add solana-foundation/pyth-skill
   ```
3. **Create Solana wallet**:
   ```bash
   solana-keygen new --outfile $HOME/.config/solana/id.json
   solana config set --url devnet
   solana airdrop 2
   ```
4. **Get Helius API key**: https://helius.dev (free tier)
5. **Copy `.env.example` → `.env.local`** + fill keys

### Tier 1 — Compile (~30 min)

1. **First Anchor build**:
   ```bash
   anchor build
   anchor keys list  # copy real program ID
   ```
2. **Update Anchor.toml + .env.local** dengan real program ID
3. **Rebuild dengan correct ID**: `anchor build`
4. **Frontend compile check**:
   ```bash
   npm run dev       # → localhost:3000
   npm run typecheck
   ```

### Tier 2 — Real Integration (Week 1-2)

1. **Anchor instructions logic**: replace stubs in `commit_intent.rs`, `trigger_aggregate.rs`, `execute_swap.rs`, `claim_allocation.rs` dengan real logic + tests
2. **Arcium**: apply for Cohort 2 Private Testnet at arcium.com/build, integrate `@arcium/client` ke `lib/providers.tsx`
3. **Jupiter integration**: use `@jup-ag/api` di `lib/jupiter.ts` untuk quote fetching, CPI dari Anchor program for swap exec
4. **Pyth oracle**: integrate `pyth-solana-receiver-sdk` di `execute_swap.rs` for price snapshot
5. **Privy embedded wallet**: integrate `@privy-io/react-auth` providers
6. **MoonPay top-up**: integrate widget di `setup/page.tsx`

### Tier 3 — Tests (Week 2-3)

1. **Anchor tests**: `tests/tide.test.ts` covers all 6 instructions
2. **Arcis unit tests**: `cargo test` di `confidential-ixs/` (already scaffolded)
3. **Surfpool integration test**: mainnet-state simulation untuk Jupiter integration
4. **End-to-end test**: complete window cycle (commit → aggregate → execute → claim)

### Tier 4 — UX & Demo (Week 3-4)

1. **Setup wizard polish**: add token selector, multi-step flow, transaction confirmation states
2. **Dashboard real-time updates**: WebSocket subscribe ke Window account changes
3. **Savings analytics**: chart historical savings vs standalone DCA
4. **Mobile responsive**: tested on Phantom Mobile in-app browser
5. **Demo Loom**: side-by-side standalone Jupiter DCA vs Tide pool

### Tier 5 — Pre-Launch (Week 4-5)

1. **Twitter handle**: register `@tide_dca`
2. **Pre-recruit beta users**: DM 50-100 retail crypto Twitter Indo + global
3. **Discord server**: "Tide Founders"
4. **Bootstrap pool seed liquidity**: $10K USDC initial
5. **Build publicly daily** (per "How to Win" doctrine)
6. **Submission**: Loom <3min, GitHub README polished, deck ready, deployed devnet

---

## Conventions Locked

### Anchor
- Program ID: `Tide1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (placeholder)
- PDA seeds: `b"pool"`, `b"dca-position"`, `b"window"`, `b"intent"`, `b"escrow"`
- USDC devnet: `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr`
- USDC mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- SOL native: `So11111111111111111111111111111111111111112`

### Frontend
- Server Components default
- `'use client'` only for wallet/interactive
- Tailwind utility-first
- Cyan accent (`#06b6d4`) on zinc-950 background
- Brand tone: precise, financial, ocean metaphor

### Branding
- Codename: **Tide**
- Domain target: `tide.fun`
- Twitter: `@tide_dca`
- Tone: precise + financial + slight ocean metaphor (flow, currents, tide)

---

## Risks Tracked (from idea-context.md Section 5)

Engineering-focused risks:
- Arcium MPC latency vs window duration → Day 1-3 spike to validate
- Jupiter IOC + Jito bundle integration → Week 1 spike
- Cold start liquidity → bootstrap budget $10K
- Smart contract escrow risk → audit + caps

---

## Tooling Status

| Tool | Status |
|---|---|
| Colosseum Copilot | ✅ configured at User env scope |
| 31 solana-new skills | ✅ globally installed (`~/.claude/skills/`) |
| `colosseum-resources` | ✅ project-scope `.agents/skills/` |
| `find-skills` | ✅ globally |
| Helius MCP | ⏳ configured, awaiting `HELIUS_API_KEY` |
| Privy SDK | ⏳ to integrate Week 1 |
| Arcium client | ⏳ to integrate after Cohort 2 access |
| Jupiter SDK | ⏳ to integrate Week 1 |

---

## Phase Handoff Spec

```json
{
  "phase": "build-scaffold-complete",
  "stack": {
    "skills": ["programs-anchor", "frontend-framework-kit", "pyth-skill", "testing", "security"],
    "mcps": ["helius-mcp"],
    "repos": ["custom-scaffold (Arcium-extended Pattern 1)"]
  },
  "architecture": "Next.js + Anchor + Arcium MXE + Jupiter IOC",
  "build_status": {
    "scaffold_complete": true,
    "first_compile": false,
    "mvp_complete": false,
    "tests_passing": false,
    "devnet_deployed": false
  },
  "next_command": "/build-with-claude"
}
```

When ready untuk implementation, invoke **`/build-with-claude`** untuk guided MVP build.
