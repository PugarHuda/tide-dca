# Tide

> **DCA without MEV. Bots blind, retail wins.**

[![Solana](https://img.shields.io/badge/Solana-Frontier_2026-9945FF)](https://colosseum.com/frontier)
[![Built with](https://img.shields.io/badge/Built_with-Arcium_MPC-06b6d4)](https://arcium.com)

## What

Tide adalah **Hidden-Liquidity DCA Pool** untuk Solana retail. Encrypted intents via Arcium MPC, aggregate execute via Jupiter IOC, pro-rata distribute. Retail dapet institutional-grade fills + MEV protection.

## Why

- Solana DCA volume Q1 2026: ~$80M/month
- MEV extraction on retail DCA: 0.3-0.8% per trade
- Annual extraction from retail: **$3-8M+**
- Tide aggregates retail flow → bot sees only ciphertext → no MEV

## Pattern Match

URANI ($30K Renaissance Grand) + Archer Exchange ($10K Cypherpunk) menang dengan "MEV protection" narrative — but for **whales/MMs**. Tide applies same pattern to **retail's most common behavior** (recurring buys).

## Stack

- **Anchor** (Rust) — on-chain program
- **Arcium Arcis DSL** — confidential aggregate compute
- **Next.js 15** — frontend
- **Phantom Connect** — wallet
- **Jupiter** — DEX execution (IOC)
- **Pyth** — oracle for window pricing
- **Helius** — RPC

## Quick Start

```bash
# Install deps
npm install

# Setup wallet + RPC
solana-keygen new --outfile $HOME/.config/solana/id.json
solana config set --url devnet
solana airdrop 2

# Configure env
cp .env.example .env.local
# Edit .env.local: add Helius API key, etc.

# Build + deploy Anchor
anchor build
anchor keys list  # copy ID → Anchor.toml + .env.local
anchor build      # rebuild
anchor deploy

# Frontend
npm run dev       # → http://localhost:3000
```

## Phase Status

- [x] Phase 1 (Idea) — `.superstack/idea-context.md`
- [x] Phase 2 (Build scaffold) — `.superstack/build-context.md`
- [ ] Phase 2 (Build implementation) — in progress
- [ ] Phase 3 (Launch) — TBD

## Documentation

- `CLAUDE.md` — full project context
- `.superstack/idea-context.md` — wedge thesis + risk register
- `.superstack/build-context.md` — build plan + status
- `.research/` — hackathon intelligence (sponsors, judges, winners)

## License

TBD (likely MIT for program code, proprietary for frontend).

## Acknowledgments

Built dengan: Solana Foundation + Colosseum (Frontier hackathon), Arcium (Privacy 2.0), Phantom (Grand prize sponsor), Privy (embedded wallets), MoonPay (fiat ramp), Reflect (yield-bearing stables), Jupiter (DEX).

Generated dengan `/scaffold-project` skill dari [solana.new](https://solana.new).
