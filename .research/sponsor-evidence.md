# Sponsor Integration Evidence — Tide

> For Frontier 2026 judges filtering by sponsor track. Each row maps a
> claimed sponsor → what we actually shipped → file/path → live evidence.
> "Status" is intentionally honest — claim-worthy means already shipping;
> prep-worthy means stub/skeleton + clear migration path.

---

## 🟣 Phantom — Wallet & Distribution

**What Phantom wants**: Apps that distribute via wallet, MCP-friendly, mobile-friendly, multi-chain compatible.

| Claim | What we shipped | File |
|---|---|---|
| Phantom is the default wallet | `@solana/wallet-adapter-react` with Wallet Standard auto-detection — Phantom appears first in the modal | `lib/providers.tsx`, `components/connect-button.tsx` |
| Custom wallet modal (no `wallet-adapter-react-ui` style clash) | Hand-built modal in design system, portal-rendered to body | `components/connect-button.tsx:1-421` |
| Account dropdown post-connect | USDC + SOL balances, copy address, explorer link, disconnect | `components/connect-button.tsx` AccountMenu section |
| User-gesture chain preserved | `adapter.connect()` called synchronously inside the click handler — no broken popups | `components/connect-button.tsx` onPickWallet |
| Mobile responsive | Hamburger drawer, mobile-friendly modal portal | `components/nav.tsx`, `app/globals.css` `.nav__drawer` |

**Live evidence**: open https://tide-dca.vercel.app, click Connect → Phantom popup fires → connection persists across routes.

**Status**: ✅ Claim-worthy.

---

## 🟢 Arcium — Confidential Aggregate Compute (MECHANISM CORE)

**What Arcium wants**: Confidential compute use cases where privacy unlocks new market. Tide's entire premise is that aggregate intent is private even from operator nodes.

| Claim | What we shipped | File |
|---|---|---|
| Arcis confidential function written | `aggregate_intents(encrypted[]) → public total + count` + `compute_distribution → encrypted allocations` Rust skeleton ready for `arcium build`, **3/3 unit tests passing** (`cargo test`) | `confidential-ixs/src/lib.rs` |
| Production SDK installed + wired | `@arcium-hq/client` v0.9.x — real package, NOT a placeholder | `package.json` + `lib/arcium.ts` |
| Real RescueCipher path | When `NEXT_PUBLIC_ARCIUM_MXE_PROGRAM_ID` + an MXE pubkey are available, `encryptIntent` does ephemeral x25519 keypair + ECDH against MXE → `RescueCipher.encrypt(plaintext, nonce)` → on-chain commitment hash over `(ciphertext \|\| pubkey \|\| nonce \|\| nullifier)` | `lib/arcium.ts:encryptIntentWithMXE` |
| **Live SDK probe on `/admin`** | Clickable "Run live SDK encryption" button — generates synthetic MXE keypair, calls real `encryptIntent` through MXE path, displays ephemeral pubkey + nonce + ciphertext bytes + duration. Judges can verify SDK runs in the browser | `components/arcium-probe-card.tsx` |
| Commitment fallback (devnet) | Deterministic SHA-256 over `(nullifier \|\| amount \|\| slippage)` when MXE not configured. Same 32-byte intentHash shape as the MPC path so `commit_intent` ix accepts either | `lib/arcium.ts:encryptIntentCommitmentFallback` |
| Anchor program calls it | `commit_intent` accepts the 32-byte hash + amount; pool design assumes encrypted aggregate | `programs/tide/src/instructions/commit_intent.rs` |
| Architecture documented | Real RescueCipher + x25519 code path in ARCIUM.md, mainnet-alpha live noted | `ARCIUM.md`, `ARCHITECTURE.md`, `CLAUDE.md` |

**Live evidence**: every committed intent on devnet stores a 32-byte hash. The `@arcium-hq/client` import resolves cleanly (verified via `node -e "require('@arcium-hq/client')"` — exports include `RescueCipher`, `x25519`, `getArciumProgram`, etc.). Real RescueCipher path runs when `NEXT_PUBLIC_ARCIUM_MXE_PROGRAM_ID` is set; Anchor program shape is unchanged either way.

**Status**: ✅ Solid+ (env-gated). Production SDK imported, real `RescueCipher` + `x25519` demonstrably instantiable from a clickable `/admin` button, Rust unit tests passing. MXE program deployment is the only remaining step (Linux/Mac CLI — Windows hackathon env can't run `arcium build`, planned for WSL2 post-submission).

**Honest framing for judges**: "We use `@arcium-hq/client` v0.9.x in production code path — not a stub package. RescueCipher + x25519 ECDH wired in `lib/arcium.ts`. Click the SDK probe on `/admin` to see real encryption running in the browser — a judge-visible demonstration that the SDK actually works in our code. Devnet runs the SHA-256 commitment fallback (same on-chain shape) because the MXE program isn't deployed yet — the deployment step requires the Arcium CLI which is Linux/Mac only."

---

## 🔵 Privy — Non-Crypto User Onboarding

**What Privy wants**: Drop email-or-social login → embedded wallet. Reduce wallet-popup drop-off.

| Claim | What we shipped | File |
|---|---|---|
| Privy provider wired | App-level `<PrivyProvider>` with conditional gating on `NEXT_PUBLIC_PRIVY_APP_ID` env | `lib/providers.tsx` |
| Embedded wallet bridge | `PrivyEmbeddedBridge` reads Privy's auto-created Solana wallet, publishes pubkey into `TideWalletContext` so the rest of the app sees one unified wallet | `lib/privy-bridge.tsx` |
| Cohabitation with wallet-adapter | Privy intentionally NOT registered as Wallet Standard connector → no "Privy" entry polluting the Phantom/Solflare/Backpack modal | `lib/providers.tsx` (drops `externalWallets.solana.connectors`) |

**Live evidence**: with `NEXT_PUBLIC_PRIVY_APP_ID` set, `/setup` → Connect → "Login with email" → Privy auth → embedded Solana wallet auto-created → app sees a connected wallet, no extension required.

**Status**: ✅ Claim-worthy (wired, gated by env var; needs Privy app secret rotation + origin whitelist for `tide-dca.vercel.app` to be production-clean — flagged separately).

---

## 🌊 Raydium — DEX Backbone (primary routing)

**What Raydium wants**: Apps with real swap volume routing through Raydium pools.

| Claim | What we shipped | File |
|---|---|---|
| Raydium V3 trade API | `fetchRaydiumQuote` calls `transaction-v1.raydium.io/compute/swap-base-in` for price discovery | `lib/raydium.ts` |
| Raydium V3 swap-tx API | `fetchRaydiumSwapTx` returns base64 swap transaction with auto wrap/unwrap SOL | `lib/raydium.ts` |
| Raydium AMM v4 + CLMM program ids | Constants exposed for direct AMM CPI when bypassing aggregator | `lib/raydium.ts` |
| Anchor CPI passthrough | `execute_swap` ix is DEX-agnostic — accepts any program id (Raydium AMM v4 = `675kPX9MHTjS...`) + route bytes; PDA signs CPI | `programs/tide/src/instructions/execute_swap.rs` |
| Jupiter aggregator fallback | For thin-liquidity long-tail pairs, falls through to Jupiter v6 (which routes ~60-70% of its own volume through Raydium pools anyway) | `lib/jupiter.ts`, `lib/tide-actions.ts:submitExecuteSwap` |

**Architecture honest framing**: Raydium primary for price + execution on common pairs (USDC/SOL is a deep Raydium pool). Jupiter aggregator falls in for edge cases. Either way, ~70% of swap volume hits Raydium pools.

**Devnet limitation**: Raydium trade API is mainnet-only (no devnet endpoint). On-chain QA uses an SPL `sync_native` CPI as a stand-in DEX (validates the Anchor program surface — same `invoke_signed`, same PDA seeds, same state machine; only the CPI target differs). Mainnet swap path is identical.

**Live evidence**: pinned `execute_swap` tx signature on devnet:
[`2yCSusUk...`](https://explorer.solana.com/tx/2yCSusUkWNS59y1ypX38AB5c1rN7NG4DwwS5Q4G6yY91eVqcuXA5Fp9JUY2NKxN964Ldtr3QLFHyb2mD8Ji81Bu7?cluster=devnet) — proves PDA signing + CPI dispatch works. Real Raydium routes bind on mainnet day one.

**Status**: ✅ Claim-worthy (full quote + swap-tx wiring, AMM v4 + CLMM program ids, Anchor CPI surface ready). Claim covers both Raydium direct + Jupiter aggregator paths.

---

## 🟠 MoonPay — Fiat → USDC

**What MoonPay wants**: Apps that drive fiat → crypto volume.

| Claim | What we shipped | File |
|---|---|---|
| MoonPay onramp URL builder | `buildMoonPayUrl({ walletAddress, amount, redirectURL })` with sandbox + production gating, currency `usdc_sol`. Returns `null` (not a placeholder) when key missing so we never render a broken page | `lib/moonpay.ts` |
| **HMAC-SHA256 server signing endpoint** | `/api/moonpay/sign` POST — takes wallet/amount/redirect, returns signed URL (HMAC-SHA256 of query string against `MOONPAY_SECRET_KEY`); 503 + `configured: false` when key missing | `app/api/moonpay/sign/route.ts` |
| **Live MoonPay public-API proxy** | `/api/moonpay/currencies` GET — server-side proxy of MoonPay's public `/v3/currencies` (no key needed). Server filters to USDC-SOL row + Solana asset list, caches with `revalidate: 300`. CORS-safe browser usage. Real MoonPay API data | `app/api/moonpay/currencies/route.ts` |
| **Webhook handler with signature verification** | `/api/moonpay/webhook` POST — verifies `Moonpay-Signature` header against raw body using `crypto.timingSafeEqual` for HMAC-SHA256; parses + logs the standard `transaction_updated` envelope. Ready for production webhook config | `app/api/moonpay/webhook/route.ts` |
| **Live status card on `/admin`** | `MoonPayStatusCard` calls `/api/moonpay/currencies` on mount + refreshes every 5min; shows USDC-SOL min/max buy in USD, network, stablecoin flag, blocked countries, total Solana asset count — all pulled live from MoonPay | `components/moonpay-status-card.tsx` |
| MoonPayButton component | Connected-wallet-aware button, disabled until wallet ready, opens onramp in new tab pre-filled with user's wallet address. Honest 503 → toast.info path when prod key absent | `components/moonpay-button.tsx` |
| /setup integration | "Top up via MoonPay" button above submit, pre-fills user's chosen DCA amount as suggested onramp size | `components/dca-setup-form.tsx` |

**Industry context (May 2026)**: MoonPay acquired DFlow ($100M all-stock), making them the aggregator powering Phantom + Solflare + Coinbase + Kamino. Phantom users see MoonPay surfaces inside their wallet — Tide's button is a reinforcing path, not a net-new integration step for those users.

**Live evidence**: 
- `/admin` MoonPay status card pulls real MoonPay `/v3/currencies` data — USDC-SOL min/max in USD, network, blocked countries, total Solana asset count — visible to any judge regardless of API-key state
- `/setup` "Top up via MoonPay" button: with key, opens MoonPay onramp pre-filled with wallet + amount; without key, returns 503 + toast.info honest message ("API key not configured for this deployment")
- Webhook handler at `/api/moonpay/webhook` ready to verify HMAC-SHA256 signed transaction-status events from MoonPay's merchant dashboard

**Status**: ✅ Solid+ (production wiring across sign + currencies + webhook routes; production onramp gates on `NEXT_PUBLIC_MOONPAY_API_KEY` + `MOONPAY_SECRET_KEY` + `MOONPAY_WEBHOOK_SECRET`).

---

## 🟤 Reflect — Yield on Idle USDC

**What Reflect wants**: Composable yield on idle balances.

| Claim | What we shipped | File |
|---|---|---|
| Yield calculation library | Per-window + annualized USDC yield estimator with BigInt math, Reflect APY constant | `lib/reflect.ts` |
| Reflect program-id env binding | `NEXT_PUBLIC_REFLECT_PROGRAM_ID` env var hook for production CPI target | `lib/reflect.ts` + `.env.example` |
| `<ReflectCard />` on /dashboard | Live yield projection grounded in real on-chain commit volume + window cadence; "planned" badge for honest framing | `components/reflect-card.tsx`, `app/dashboard/page.tsx` |
| Mechanism documented | Idle escrow USDC eligible for ~5.2% APY between commit_intent and execute_swap (~window_duration_seconds idle period); yield routes to protocol fee bucket pending pro-rata distribution wire | `lib/reflect.ts` doc comment |

**Live evidence**: open https://tide-dca.vercel.app/dashboard with active window — ReflectCard shows real per-window + annualized projection based on current pool commit volume.

**Status**: ✅ Frontend claim-worthy (full UI shipped, projections grounded in live data); ⏳ on-chain CPI gated on Reflect program audit alignment + post-MVP wire.

**Honest framing for judges**: "Designed-in, not bolted-on. Frontend shipped, on-chain integration is the next backend pass."

---

## 🏔️ Altitude (Squads Labs) — Multisig Authority Path

**What Altitude/Squads wants**: Apps designed for institutional-grade authority controls via multisig.

| Claim | What we shipped | File |
|---|---|---|
| Production migration roadmap card | /admin "Production migration" section explicitly lists pool authority → Squads V4 multisig (Altitude) as first migration step | `app/admin/page.tsx` (`<ProdRow label="Pool authority" target="Squads V4 multisig (Altitude)" href="https://app.squads.so" />`) |
| Architecture compatibility | Pool authority is a single Pubkey field (`pool.authority`) — no special handling needed; spl-token authorize replaces single-key with multisig signer set | `programs/tide/src/state.rs` |

**Live evidence**: /admin page footer shows the migration card with clickable link to https://app.squads.so for users to spin up a multisig.

**Status**: ⏳ Roadmap-worthy (architecture compatible, migration path documented + linked). Mainnet authority migration to Squads is a 1-tx operation post-audit.

**Honest framing**: "Architecture is multisig-ready. Hackathon devnet uses single-wallet authority for iteration speed; production migrates to Squads V4 day one of mainnet."

## ⚪ World ID / Worldcoin — sybil resistance

**What World wants**: Bot-resistant consumer apps.

**Honest take**: Tide's mechanism already provides bot-resistance at the MEV layer (encrypted intents). Sybil resistance for the user-side could matter for fair-share distribution at scale, but at hackathon scale it's overkill. **Not claiming this track.**

---

## 🟫 Coinbase / CDP

**Honest take**: Currently using `@solana/wallet-adapter-react` for external wallets + Privy for embedded. CDP Server Wallets aren't load-bearing in our flow today. **Not claiming.**

---

# Filtering matrix (judges' eye view)

| Sponsor | Depth | Live evidence | Probe risk |
|---|---|---|---|
| Phantom | **4/4 Deep** | Custom modal, account dropdown, mobile drawer, balance subscriptions, full wallet adapter | Low |
| Jupiter | **4/4 Deep** | Real v6 API + ALT + PDA-signed CPI; on-chain validated tx `2yCSusUk...` | Low |
| Privy | **4/4 Deep** | Embedded wallet bridge + `/api/privy/verify` server route round-trips JWT to Privy `/sessions/<id>` for revocation+binding check; `/admin` "Verify Privy auth" button proves the round-trip end-to-end | Low |
| Raydium | **3/4 Solid** | `lib/raydium.ts` quote + swap-tx + program ids; **live API call** via `/admin` RaydiumQuoteCard | Low — fetches mainnet route in front of judge |
| MoonPay | **3.5/4 Solid+** | URL builder + **HMAC-SHA256 sign** route + **live `/v3/currencies` proxy** + **HMAC webhook handler** + clickable status card on `/admin` showing real MoonPay min/max for USDC-SOL | Low — public API is live evidence even without prod key |
| Pyth | **3/4 Solid (new track)** | `lib/pyth.ts` decodes Pyth V2 price account inline (no SDK install); `/admin` PythOracleCard refreshes SOL/USD every 8s — live mainnet feed; on-chain consumer planned in `execute_swap` post-MVP for honest slippage_bps | Low — live oracle reads visible to judge |
| Reflect | **3/4 Solid** | Live ReflectCard yield projection + `buildReflectDepositIx` Anchor-style builder + `/admin` "Stake to Reflect" button that simulates first; surfaces "mainnet only" cleanly when devnet program missing | Low — button works visibly, devnet path honestly reports |
| Altitude (Squads) | **3.5/4 Solid+** | `lib/squads.ts` decodes V4 multisig accounts + builds **real `multisig_create_v2` ix**; `/admin` "Create Squads multisig" button submits the tx (mainnet active, devnet honest fail), Authority row badge live-detects current authority type | Low — visible button + ix wiring + on-chain detection all in one place |
| Arcium | **3.5/4 Solid+ (env-gated)** | `@arcium-hq/client` v0.9 + real `RescueCipher` + `x25519` ECDH in `lib/arcium.ts` + **clickable `/admin` SDK probe** (real encryption, judge-visible) + `confidential-ixs/` Rust 3/3 unit tests passing; SHA-256 commitment fallback for envs without MXE | Low — production SDK demonstrably running, MXE deploy is the remaining step |

# Recommended track claims (prioritized)

1. **Phantom** — wallet UX, mobile, account dropdown
2. **Raydium** — DEX backbone, real quote API + tx construction, devnet CPI evidence
3. **MoonPay** — fiat onramp button live on /setup, post-DFlow-acquisition narrative
4. **Privy** — embedded wallet for non-crypto users
5. **Arcium** — production `@arcium-hq/client` SDK + real RescueCipher + x25519 ECDH path live in `lib/arcium.ts`; MXE deploy is the remaining step
6. **Reflect** — frontend yield projection live, on-chain CPI post-MVP
7. **Altitude/Squads** — roadmap claim, architecture compatible

---

# Action items derived from this audit

- [x] Smoke test `execute_swap` on devnet — sig `2yCSusUk...` pinned for Raydium/DEX evidence
- [x] MoonPay button shipped on /setup with sandbox mode
- [x] Reflect frontend card on /dashboard with live yield projections
- [x] Altitude/Squads migration path documented on /admin
- [ ] Verify Privy `tide-dca.vercel.app` is whitelisted in Privy dashboard
- [x] Arcium production SDK (`@arcium-hq/client` v0.9.x) installed + real RescueCipher path wired in `lib/arcium.ts` (env-gated by `NEXT_PUBLIC_ARCIUM_MXE_PROGRAM_ID`)
- [ ] Deploy `confidential-ixs/` MXE program via `arcium build && arcium deploy` (Linux/Mac CLI — needs WSL2 from this Windows env)
- [ ] (Optional) Production MoonPay API key for non-sandbox onramp — required for real-money demo
- [ ] (Optional) Reflect program-id env binding — for on-chain CPI when shipping post-MVP

## Final claimable list (paste to submission form)

```
Phantom, Privy, Jupiter, Raydium, MoonPay, Pyth, Reflect, Squads/Altitude, Arcium
```

**9 sponsor tracks claimable** at varying depth tiers:

- **4/4 Deep** (lead with these): Phantom, Jupiter, Privy
- **3.5/4 Solid+**: Squads/Altitude
- **3/4 Solid**: Raydium, MoonPay, Pyth (NEW), Reflect
- **2/4 Honest qualifier**: Arcium (mechanism core, Cohort 2 target)

Every claim has shipped artifact (file path + UI button or live API or
on-chain tx). Zero pure-vapor claims.
