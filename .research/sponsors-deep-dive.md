# Frontier 2026 — Sponsor Deep Dive (Mission, Vision, Tech, Strategic Angle)

## 🟣 PHANTOM (Grand Prize Sponsor)

**Tagline**: *"The money app that'll take you places"*

**User base**: **20M+** (updated from earlier 5M number)

**Mission**: Unified financial platform — trading + payments + wallet + self-custody

**Recent product expansion 2026**:
- Prediction Markets ("for cultural moments")
- Perpetual futures (leveraged trading)
- Visa card + Apple Pay/Google Pay
- Token discovery + top trader tracking
- **Phantom MCP Server** ⭐ — AI agents can swap/sign/manage across Solana, Ethereum, Bitcoin, Sui
- Multi-chain (Solana + ETH + Polygon + Bitcoin + Sui)

**Strategic priorities for builders**:
1. AI agent integrations via MCP server (highest priority 2026)
2. Mobile dapps via universal links/deeplinks
3. Token Extensions support
4. Solana Blinks rendering
5. React SDK + Server SDK

**Key contacts**: Brian Friel (DevRel, workshop Apr 21), Adam Gutierrez (Maximizing Developer Gains), Trevor (BD)

**What they want from hackathon**: Apps that distribute via Phantom (use 20M user base), AI agent integrations using their new MCP server, mobile-first dapps

---

## 🏔️ ALTITUDE

**Tagline**: *"Financial operating system for businesses on the frontier"*

**Mission**: Run your business on stablecoins — accounts, cards, payments in 150+ countries

**Built on**: Squads smart account infrastructure ($10B+ secured, 500+ orgs)

**Recent**: $18M raise April 29, 2026 (Solana Ventures lead). $200M+ payments processed.

**Target customers** (very specific):
- Stablecoin businesses, exporters/importers, global startups
- Digital agencies, e-commerce, cross-border merchants
- SaaS, trading firms, **AI-first founders**
- Solo operators, lean finance teams, contractors

**Product suite**:
- **Accounts**: Multi-currency (USD/EUR/MXN/BRL/GBP), 3.25% APY, ACH/SEPA/Wire/SWIFT/stablecoin rails
- **Cards**: Virtual + physical, expense management, receipts, cashback, spend policies
- **Operations**: AP/AR, invoicing, accounting ledger across fiat + stablecoins
- **Agents**: Self-driving financial ops, automated payment execution, real-time burn/runway

**Differentiator vs banks**:
- Self-custodial (users own keys)
- Treasury = programmable blockchain objects
- Code-enforced policies (not intermediary interpretation)
- Real-time verifiability of balances/transfers

**Compliance**: SOC 2 Type I, formally verified, independently audited, open-source components

**Visible partners**: Metaplex, Jupiter, Kamino, MetaDAO

**Workshop**: Apr 14, Garrett Harper (Squads partnerships)
**Judge**: Phil Jacobson (CBO)

**What they want**: Apps yang serve their target customers (especially AI-first founders, SaaS, cross-border businesses). Anything yang bikin business operations on stablecoins lebih easier.

---

## 🔵 PRIVY

**Tagline**: *"Frictionless and secure UX — the tech stack onboarding millions to Solana"*

**Track record**: 8.5M+ users onboarded onchain

**Solana Developer Platform**: Privy = official wallet infrastructure for SDP

**Philosophy**: "Let users sign, swap, stake without learning crypto"

**Recommended stack untuk Solana onboarding**:
- Embedded wallets (email/social/SMS/passkey/wallet)
- **Helius RPC** for tx performance
- **MoonPay + Coinbase Pay** for fiat ramps (built-in integration)
- Cross-chain bridging EVM ↔ Solana
- Server-side managed wallets sebagai fee payer

**Key integration patterns**:
1. **Managed Wallet Fee Payer**: Client signs → backend co-signs + broadcasts → user pays no gas
2. **Account Funding**: Embed MoonPay/Coinbase Pay directly (no leave app)
3. **Multi-wallet**: Embedded + external wallet flexibility (Phantom adapter etc.)

**Success metrics**:
- **40%+ month-over-month retention** for embedded wallet apps (their case studies)
- Pump.fun: one-tap trading, users transacted millions without leaving app
- Jupiter Quick Account: instant trades across Phantom/Solflare/email/X
- Moonwalk: mobile onboarding without seed phrases

**What they want**: Apps yang demonstrate frictionless mass-onboarding (email signup → working wallet in seconds). Yang bisa show retention numbers > 40% MoM.

---

## 🟢 ARCIUM

**Tagline**: *"Privacy 2.0 — shared private state on Solana"*

**Mission**: Bridge crypto from Privacy 1.0 (isolated private state) → 2.0 (multi-party shared private state)

**Built by**: Elusiv team (created Privacy 1.0 shielded transactions on Solana)

**Tech stack**:
- **Arcis** — Rust DSL extending Anchor for MPC circuits
  - Masked types: `mu64`, `mbool`, `mu128` (encrypted variants)
  - Mark function `[confidential]` — Arcium handles MPC machinery
- **MXEs** (Multi-Party eXecution Environments) — isolated virtual envs for secure compute
- **ArxOS** — distributed OS coordinating Arx node clusters
- **2 MPC protocols**:
  - **Cerberus**: 1-of-N honest, MAC-authenticated, strongest security
  - **Manticore**: Faster (matrix-based, ML/AI optimized), trusted dealer model

**Use cases highlighted (their priorities for builders)**:
1. **Dark Pools / CLOBs** (40% of US stock vol = dark pool benchmark)
2. **Private AI Inference** (DeFAI, personalized AI without data exposure)
3. **Private AI Training** (medical records collab, pharma research)
4. **Confidential DeFi** (private lending, trade protection)
5. **Private Gaming** (poker, hidden-info Doom-like)
6. **DeFAI** (split private keys via MPC, never reconstructed)
7. **Data monetization** (encrypted marketplaces)
8. **DeSci** (collaborative research with private data)

**Status**: Cohort 2 of Private Testnet (final phase before Public Testnet launch)

**Comparison vs alternatives**:
- TEEs: fast but hardware-trust + side-channel risk
- FHE: secure but slow
- ZKPs: verifiable but no shared private state, only single-user
- **MPC (Arcium)**: high-performance, decentralized, "1 honest party enough"

**Past hackathon track record**:
- Solana Privacy Hack Jan 2026 ($100K+ prizes)
- 30+ apps deployed in testnet
- 300+ hackathon submissions across ecosystem
- **Melee Markets** ($20K Breakout 2nd) used Arcium

**Judges**: Arihant Bansal (Engineer), Milian (Privacy GCR)

**What they want**: Builders yang exploit "shared private state" use cases — anything where privacy unlocks markets that didn't exist. Especially Dark Pools, Private AI, Private Gaming.

---

## ⚪ WORLD (Worldcoin)

**Tagline**: *"A new standard of trust for the internet"*

**Mission**: Universal proof of human — distinguish humans from AI online. "Every human benefits from the age of AI."

**Stack**:
- **World ID** — universal proof of human (zk-proof verification)
- **World App** — access point for ecosystem
- **World Chain** — blockchain infrastructure
- **WLD token** — universal token (launched July 2023)

**Recent partnerships (high-signal, what they prioritize)**:
- **Zoom + DocuSign** (business identity verification)
- **Browserbase + Exa + Okta + Vercel** (AI agent authentication) ⭐ — they're heavy into AI agent space
- **Concert Kit** (bot prevention in ticketing) ⭐ — direct relevant to "Better Ticketmaster" pivot
- Online dating, gaming, event ticketing

**Geographic**: Flagship orbs in SF, Seoul, Rome (expanding)

**Solana integration**: World ID expanded to Solana via Wormhole (Q1 2026) — RECENT, less competition

**Workshop**: May 3 (today!)

**Use cases they emphasize**:
- Bot prevention (ticketing, airdrops, voting)
- Business verification
- AI agent trust/access control
- Online dating safety
- Gaming sybil resistance

**What they want**: Apps yang need bot/sybil resistance. Anything where "verified human" unlocks better UX or fairer distribution. **Ticketing is explicit priority** (Concert Kit).

---

## 🟪 METAPLEX

**Ecosystem stats** (verified):
- **99% of Solana tokens/NFTs** created with Metaplex
- **$10B+ transaction value facilitated**
- **923M tokens/NFTs created**
- **11.5M unique signers**

**Products**:
- **Metaplex Core** — new NFT standard
  - Single-account design (vs multi-account legacy)
  - 80%+ cheaper minting
  - Enforced royalties
  - Collection-level operations
  - Plugin system (custom behaviors)
- **Token Metadata** — legacy NFT standard (still supported)
- **Bubblegum** — compressed NFTs
- **Token Extensions** — SPL extensions support
- **Metaplex CLI** — token/NFT terminal management

**Recent**:
- $MPLX Season 3 proposal (2.5M $MPLX budget for ecosystem expansion)
- Metaplex CLI launch
- Core NFT plugin marketplace developing

**Workshop**: Apr 28
**Judge**: Stephen Hess (Director, Metaplex Foundation)

**What they want**: Apps using **Metaplex Core** specifically (their push). NFT-native experiences with novel plugin usage. Tradeable assets, identity NFTs, ticketing, certificates.

---

## 🟠 MOONPAY

**Stats**:
- **10B+ transaction volume**
- **35M+ verified accounts**
- **180+ countries**
- **170+ payment methods**
- **500+ ecosystem partners**

**Compliance moat**: Money transmitter licenses in all 50 US states + MiCA EU + SOC 2 + PCI DSS + ISO 27001

**Product suite**:
- **Ramps** — on/off-ramp
- **Commerce** — crypto checkout
- **Swaps** — cross-liquidity routing
- **Stablecoins** — programmable treasury, instant payouts
- **Agents (2026)** ⭐ — onramp for AI agents, MoonPay CLI for AI

**Target segments**:
- Wallets/exchanges (deposit/withdrawal growth)
- Marketplaces (crypto checkout)
- Gaming + consumer apps (embedded finance)
- Enterprises/fintechs (treasury, cross-border)
- Payment service providers
- Payroll platforms

**What they want**: Apps yang drive fiat → crypto volume. Especially **AI agent integrations** via MoonPay Agents (their new push).

---

## 💰 REFLECT PROTOCOL

**Mission**: Yield-bearing stablecoin (delta-neutral)

**Mechanism**: Users deposit LSTs → mint RDC (yield-bearing stable). Solana's Ethena equivalent.

**Funding**: $3.75M seed (a16z crypto CSX accelerator + Solana Ventures + Equilibrium + BigBrain + Colosseum)

**Background**: **Won Radar 2024 Grand Champion ($50K) → became sponsor**. Meta-pattern of accelerator pipeline.

**Plans**: Integrate with Jito + Solayer for restaked insurance fund

**Judges**: Arif (Head of BD), Jacob (Cofounder)

**What they want**: Apps yang integrate yield-bearing stablecoin (idle balances earn passive). Wallet apps, savings products, payment apps with hold-time, treasury management. **Privacy-focused stablecoin** angle would be unique convergence (Reflect + Arcium).

---

## 🌊 RAYDIUM LAUNCHLAB

**Mission**: Community-powered token launch platform combining bonding curve + AMM

**Modes**:
- **JustSendit** — default settings, 85 SOL threshold to migrate
- **LaunchLab** — customizable bonding curves + fees

**Migration**: Bonding curve fills → auto-migrate to Raydium AMM, LP burned

**Fee structure**: 50% trading fee → community pool

**White-label**: Available for third-party platforms (custom branding)

**MCP server**: `kukapay/raydium-launchlab-mcp` — AI agents launch tokens via prompts ⭐

**No anti-sniper mechanism** mentioned in docs (vulnerability for "fair launch" wedge)

**Judges**: Tom, Infra

**What they want**: Apps yang route through their AMM, AI-launched tokens, novel launchpad mechanisms

---

## 🟤 COINBASE CDP

**Server Wallets v2**:
- **Solana support live** (April 2025)
- **<500ms wallet creation**
- **Sub-200ms signing latency**
- **99.9% availability**
- Allowlisting + spend caps
- No key management (Coinbase handles)
- Cross-chain replayability (sign once, update everywhere)

**Smart Wallet** vs Server Wallet:
- Smart Wallet = end-user facing, signless transactions via passkeys
- Server Wallet = server-side, programmable, AI-agent friendly

**What they want**: AI agent backends, programmable spending controls, autonomous server-side wallets. Cross-chain experiences.

---

## 🌐 SUPERTEAM

**Role**: Regional ecosystem partner program

**Regions**: UK, Germany, Brazil, India, UAE, SEA + global lead

**Programs**:
- Earn (bounty platform — stack on top of hackathon prizes)
- Build (ideas portal — 73+ curated ideas)
- Equity-free **microgrants up to $10K** for emerging market builders

**For Pugar**: Indonesian/SEA regional access, mentorship, additional grants. NOT a tech integration — apply separately for grant.
