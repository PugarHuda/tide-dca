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
| Arcis confidential function written | `aggregate_intents(encrypted[]) → public total + count` + `compute_distribution → encrypted allocations` (skeleton ready for Cohort 2 deploy) | `confidential-ixs/src/lib.rs` |
| Client-side encryption layer | `encryptIntent({ amount, maxSlippageBps, userPubkey, windowPubkey })` returns the intent hash that lands on chain — same shape that Arcium SDK will produce post-Cohort 2 | `lib/arcium.ts` |
| Anchor program calls it | `commit_intent` accepts the 32-byte encrypted hash + amount; structures escrow + distribution to be Arcium-ready | `programs/tide/src/instructions/commit_intent.rs` |
| Architecture documented | Sponsor mapping + integration story | `ARCIUM.md`, `ARCHITECTURE.md`, `CLAUDE.md` |

**Live evidence**: every committed intent on devnet stores a 32-byte hash. Inspect any `Intent` PDA on Solana Explorer to see the field. Once Cohort 2 access lands, the only thing that changes is `lib/arcium.ts` swapping the stub for real Arcium client encryption + the program callback wiring.

**Status**: ⏳ Prep-worthy (mechanism + interfaces + skeleton ready; live MPC gated on Cohort 2 access — applied at arcium.com/build).

**Honest framing for judges**: "Arcium isn't bolted on — the entire pool design is structured around encrypted aggregate compute. The fallback is a typed Rust function that ports 1:1 to Arcis."

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

## 🟡 Jupiter — DEX Routing (mechanism core)

**What Jupiter wants**: Apps that route real volume through Jupiter's swap engine.

| Claim | What we shipped | File |
|---|---|---|
| Jupiter v6 quote API | `fetchQuote` with input/output mint + amount + slippage | `lib/jupiter.ts` |
| Jupiter v6 swap-instructions API | `fetchSwapInstructions` returns raw swap ix + Address Lookup Tables | `lib/jupiter.ts` |
| Anchor CPI passthrough | `execute_swap` instruction accepts raw route data, does `invoke_signed` to the Jupiter program with caller-provided `remaining_accounts`, escrow PDA signs | `programs/tide/src/instructions/execute_swap.rs` |
| ALT resolution on client | `getAddressLookupTable` for each Jupiter-curated lookup table, compiles to v0 message | `lib/tide-actions.ts:539-666` (`submitExecuteSwap`) |
| VersionedTransaction + Compute Budget | 1.4M units budget for multi-hop swaps | same |

**Live evidence**: any settled window's `execute_swap` transaction signature on Solana Explorer shows the Jupiter program ID inside Tide's CPI. (Generate one during the smoke test; pin the sig for the demo video.)

**Status**: ✅ Claim-worthy (real CPI, not stubbed).

---

## 🟠 MoonPay — Fiat → USDC

**What MoonPay wants**: Apps that drive fiat → crypto volume.

| Claim | What we shipped | File |
|---|---|---|
| Integration plan documented | Pool funding via MoonPay widget directly to user's USDC ATA → /setup commit. Sponsor mapping in `lib/constants.ts` | `lib/constants.ts` `SPONSOR_INTEGRATIONS` |
| Stub helper file reserved | `lib/moonpay.ts` (TODO) — placeholder for widget URL builder | (TODO) |

**Live evidence**: none yet.

**Status**: ⏳ Prep-worthy (button placement + handoff URL designed; widget not yet wired — could ship in 60-90 min if claiming MoonPay track is high priority).

**Honest framing**: "Designed-in, not bolted-on — but live integration pending."

---

## 🟤 Reflect — Yield on Idle USDC

**What Reflect wants**: Composable yield on idle balances.

| Claim | What we shipped | File |
|---|---|---|
| Mechanism designed | Window escrow USDC sits idle ~50% of the time (between window open and execute_swap). Reflect deposit during open phase, withdraw before swap, yield → protocol fee bucket | `lib/constants.ts` `SPONSOR_INTEGRATIONS` |
| Stub helper file reserved | `lib/reflect.ts` (TODO) | (TODO) |

**Live evidence**: none yet.

**Status**: ⏳ Prep-worthy (design is composable, integration not yet wired).

---

## ⚪ World ID / Worldcoin — sybil resistance

**What World wants**: Bot-resistant consumer apps.

**Honest take**: Tide's mechanism already provides bot-resistance at the MEV layer (encrypted intents). Sybil resistance for the user-side could matter for fair-share distribution at scale, but at hackathon scale it's overkill. **Not claiming this track.**

---

## 🟫 Coinbase / CDP

**Honest take**: Currently using `@solana/wallet-adapter-react` for external wallets + Privy for embedded. CDP Server Wallets aren't load-bearing in our flow today. **Not claiming.**

---

# Filtering matrix (judges' eye view)

| Sponsor | Claim level | Live evidence | Risk if checked |
|---|---|---|---|
| Phantom | ✅ Claim | Frontend connect flow live | Low — works |
| Arcium | ⏳ Prep + skeleton | `confidential-ixs/` skeleton + intent hash on-chain | Medium — if judge requires Cohort 2 deployed, partial. Frame honestly. |
| Privy | ✅ Claim (gated) | Frontend wired, needs env var | Low — code is solid |
| Jupiter | ✅ Claim | Real CPI in execute_swap, settle-tx signature provable | Low — strongest claim |
| MoonPay | ⏳ Plan only | None | Skip claim unless we ship widget in remaining hours |
| Reflect | ⏳ Plan only | None | Skip claim unless we ship integration |

# Recommended track claims (prioritized)

1. **Jupiter** — strongest, real CPI, generate transaction-signature evidence during smoke test
2. **Phantom** — solid wallet UX, mobile responsive
3. **Arcium** — frame honestly: mechanism core, skeleton ready, live deployment gated on Cohort 2
4. **Privy** — solid embedded wallet bridge, gated on env config

**Skip claiming**: MoonPay + Reflect unless we ship in remaining hours (each 60-90 min effort).

---

# Action items derived from this audit

- [ ] During smoke test, capture the `execute_swap` transaction signature → pin in demo video + submission form for Jupiter evidence
- [ ] Verify Privy `tide-dca.vercel.app` is whitelisted in Privy dashboard (currently might still be localhost-only)
- [ ] Decide MoonPay/Reflect: ship in last hours OR drop those tracks (don't claim what isn't built)
- [ ] Apply to Arcium Cohort 2 if not already (arcium.com/build) — even unaccepted-application-pending is real and judge-honest
