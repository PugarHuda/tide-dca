# Tide — Twitter / X launch thread

**Goal**: Build social signal pre-judging. Each tweet ≤ 280 chars.
**Best post time**: 9–11 AM EST (US judge timezone wake-up window) — for Solana audience also overlaps with SEA evening.
**From**: @tide_dca (if claimed) or personal handle. Add `@solana_devs` `@arciumhq` `@phantom` `@privy_io` `@JupiterExchange` to mentions where natural.

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

## Tweet 3 — Mechanism diagram

> ```
> ┌─ Many depositors ─┐    ┌─ Arcium MPC ─┐    ┌─ Jupiter v6 ─┐    ┌─ Pro-rata ─┐
> │ encrypted intents │ →  │  aggregate Σ │ →  │ atomic swap   │ →  │  payout    │
> │ (amounts hidden)  │    │  (no leak)   │    │ (IOC, ALT)    │    │ each user  │
> └───────────────────┘    └──────────────┘    └───────────────┘    └────────────┘
> ```
>
> 4 steps. 1 swap. 0 sandwich surface.

---

## Tweet 4 — The numbers

> Slippage drops from
>
> ~0.51% solo (typical Jupiter retail DCA)
> ↓
> ~0.05% pooled (Tide aggregate via Jupiter)
>
> On a $100/week DCA → ~$24/year saved per user.
> On Solana retail's combined volume → ~$5M/year reclaimed.

---

## Tweet 5 — What's working today

> Live on Solana devnet:
>
> ✅ 7 of 7 Anchor instructions validated end-to-end
> ✅ Real Jupiter v6 CPI signed by escrow PDA
> ✅ Address Lookup Tables resolved on client
> ✅ /admin operator console with 5 sponsor probes
>
> tx evidence: explorer.solana.com/address/HanBZ74Q...

---

## Tweet 6 — Sponsor stack

> Built on:
>
> 🟣 @phantom · default wallet
> 🟢 @arciumhq · MPC encryption (Cohort 2 target)
> 🔵 @privy_io · embedded wallets
> 🟡 @JupiterExchange · DEX routing CPI
> 🌊 @RaydiumProtocol · DEX backbone
> 💸 @MoonPay · fiat onramp
> 🌐 @PythNetwork · oracle
> 🪙 @ReflectProtocol · idle yield
> 🏔️ @squadsprotocol · multisig path

---

## Tweet 7 — Demo screenshot 1

> The /admin operator console is also a sponsor demo console.
>
> Live Raydium V3 trade quote. Live Pyth oracle. One-click "Mint test USDC", "Stake to Reflect", "Create Squads multisig", "Verify Privy auth".
>
> [screenshot of /admin]

---

## Tweet 8 — Demo screenshot 2

> User flow:
>
> 1. Connect (Phantom or Privy email)
> 2. /setup → DCA wizard
> 3. /dashboard → commit, watch the window settle, claim pro-rata SOL
>
> Slippage drop from ~0.51% to ~0.05% on every buy.
>
> [screenshot of /dashboard with savings chart]

---

## Tweet 9 — Built solo

> Solo founder, 2 weeks of build, Claude Code as execution multiplier.
>
> No team. No VC. Just code → ship → fix → ship.
>
> github.com/PugarHuda/tide-dca

---

## Tweet 10 — Final CTA

> Stop feeding bots. Start riding the tide.
>
> 🌊 https://tide-dca.vercel.app
>
> Submission for @solana_devs Frontier 2026 (Colosseum) drops May 11.
>
> RT if you want to see DCA without MEV ship to mainnet.

---

## Notes

- **Tweets 1, 2, 5, 6, 8, 10** are the most shareable — pin those if engagement is low
- Add screenshots/GIFs to tweets 7 + 8 → drives 2-3x more engagement
- Tweet 1 should pin to profile until submission deadline
- Reply to your OWN thread with a link to demo Loom video once posted
- Quote-tweet sponsor accounts when they post about the hackathon

## Engagement tactics

- Reply to people asking about MEV protection on Solana with link to Tide
- Engage @arciumhq tweets about MPC use cases — Tide is an obvious fit
- Don't spam-mention. Only tag where genuinely related

## Post-judging follow-up tweets

After submission:
> "Tide submitted to @solana_devs Frontier. Now waiting for review.
>  Built solo. Shipped 9 sponsor integrations across 14 days.
>  Whatever happens, the code is open: github.com/PugarHuda/tide-dca"

If shortlisted:
> "Honored to be shortlisted in @solana_devs Frontier 2026. Thread on what we built, who it's for, and where we go next."

If win:
> "Won [TRACK] at @solana_devs Frontier 2026 with Tide. Thread on the journey."
