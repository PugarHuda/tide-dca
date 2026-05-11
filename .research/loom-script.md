# Tide — Loom Demo Script

**Target length**: 90 seconds (judges fast-skim)
**Tone**: Confident, declarative, slight ocean metaphor
**Background music**: optional ambient cyan/synth, low volume

> Last refreshed 2026-05-11 to reflect current state: 10 instructions,
> 7 successful Anchor upgrades, 13 QA cases, /demo interactive page,
> refund flow validated end-to-end on devnet.

---

## Pre-recording checklist

- [ ] Hard refresh `tide-dca.vercel.app` (Ctrl+Shift+R) — clean state
- [ ] Phantom on devnet, wallet `3QfHXyf...` connected (the funded one)
- [ ] Browser at 1280×720 (or 1920×1080), zoom 100%
- [ ] Console closed, dock cleaned, no notification clutter
- [ ] Loom in `Cam + Screen` mode, 1080p
- [ ] Mic muted while not narrating, push-to-talk if possible
- [ ] Tabs prepared in this order:
  1. `https://tide-dca.vercel.app/` (landing)
  2. `https://tide-dca.vercel.app/demo` (auto-walkthrough — backup view)
  3. `https://tide-dca.vercel.app/setup` (DCA wizard)
  4. `https://tide-dca.vercel.app/dashboard` (user view)
  5. `https://tide-dca.vercel.app/admin` (operator console)
  6. `https://explorer.solana.com/address/HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg?cluster=devnet` (program)

---

## Script (with screen actions)

### 0:00–0:10 — Hook

**Action**: Landing page open. Predator eyes in background. Brief scroll
so judge sees the hero.

**Narration**:
> "Solana retail loses about five million dollars a year to MEV bots
> sandwiching DCA orders. Tide makes that impossible."

---

### 0:10–0:20 — The mechanism

**Action**: Scroll to "How Tide fixes it" diagram. Point at the 3 stages
(commit → MPC aggregate → atomic swap).

**Narration**:
> "Users encrypt their intents client-side via Arcium MPC. The pool
> aggregates encrypted commits across many depositors. One swap executes
> for everyone. Bots see the bucket grow but can't read individual
> amounts."

---

### 0:20–0:32 — Show real on-chain state

**Action**: Open `/dashboard` tab. Point at the live window status card
(countdown ticking, real committed amount, real intent count).

**Narration**:
> "This is live devnet state right now. Window number eight is open
> with real committed USDC. Same program, same instructions you'd hit
> on mainnet — just devnet for the demo."

---

### 0:32–0:45 — The product flow (use /demo for fast pacing OR /setup live)

**Action**: Open `/demo` tab. Let the auto-cycle show 2-3 steps. Each step
links to a real devnet tx.

**Narration**:
> "Every step here is backed by a real on-chain transaction.
> commit_intent — escrows USDC. trigger_aggregate — closes the window.
> execute_swap — single atomic Jupiter v6 swap. claim_allocation — pro
> rata distribution. All seven core instructions validated on devnet."

---

### 0:45–0:58 — The audit story (differentiator)

**Action**: Open the repo at `INTEGRITY.md` in a new tab. Scroll to the
"Mocked/hardcoded" section.

**Narration**:
> "We ran our own audit on submission day and surfaced five findings.
> All five closed in code, four deployed on-chain via seven successful
> Anchor upgrades. We added a safety layer: mark_window_failed plus
> refund_intent lets users recover funds if a swap can't execute.
> Closed loop. We published the self-audit so judges see disclosure
> first, not surprises."

---

### 0:58–1:15 — Refund flow proof (the unique flex)

**Action**: Open `/demo` and jump to step 5b/6b (failure branch). Click
through to one of the pinned txs (`SDrdCnJ3...` refund_intent).

**Narration**:
> "Most DCA products demo only the happy path. Tide ships the failure
> escape hatch as a first-class concept. Here's the refund_intent
> transaction on devnet: wallet recovered the exact intent amount.
> Three on-chain transactions prove the full recovery flow works."

---

### 1:15–1:25 — Sponsor depth

**Action**: Open `/admin` tab. Point at the live Arcium SDK probe + Pyth
oracle card + MoonPay status card + Raydium quote card.

**Narration**:
> "Nine sponsor integrations, all real. Arcium's RescueCipher SDK
> running in your browser. Pyth oracle live mainnet feed.
> MoonPay's currencies API live. Jupiter v6 PDA-signed CPI proven on
> devnet. Privy embedded wallet, Phantom, Squads V4, Raydium V3, all
> wired."

---

### 1:25–1:30 — Close

**Action**: Back to landing page. Hold on the hero.

**Narration**:
> "DCA without MEV. Bots blind, retail wins. Tide — built for Solana
> Frontier 2026."

---

## Optional 60-second cut

If 90s is too long, trim by cutting:
- 0:32–0:45 product flow detail (skip /demo, just say "10 instructions
  live")
- 1:15–1:25 sponsor depth (just name Arcium + Jupiter + Phantom)

Final 60s: hook (10s) + mechanism (10s) + on-chain state (12s) + audit
story (13s) + refund proof (10s) + close (5s).

---

## Backup if a feature breaks during recording

- If wallet popup hangs: switch to `/demo` and narrate over the
  auto-cycle instead of the live form
- If devnet RPC is slow: read from `tide-dca.vercel.app` cached SSR
  rather than expecting real-time tx confirmation
- If admin probe doesn't load: cite the on-chain tx pin in the README
  instead (`https://explorer.solana.com/tx/2yCSusUk...`)

---

## Numbers to mention if asked

- **10 Anchor instructions** (was 7 at scaffold)
- **7 successful upgrades** on devnet during submission day
- **13/13 sponsor QA cases** passing on prod
- **5 of 5 audit findings** closed in code + on-chain
- **3 pinned refund-flow txs** validating the full failure path
- **9 sponsor integrations** — all real, depth ranges 3/4 to 4/4

These numbers come from the README + INTEGRITY.md. If a judge wants
specifics during Q&A, link to those docs.

---

## File references

- `/demo` page source: `app/demo/page.tsx`
- Refund flow validation: `scripts/test-refund-flow.mjs`
- Audit findings closure: `.research/honest-depth.md` +
  `INTEGRITY.md`
- Sponsor evidence: `.research/sponsor-evidence.md`
