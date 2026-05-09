# Tide — Loom Demo Script

**Target length**: 90 seconds (judges fast-skim)
**Tone**: Confident, declarative, slight ocean metaphor
**Background music**: optional ambient cyan/synth, low volume

---

## Pre-recording checklist

- [ ] Hard refresh `tide-dca.vercel.app` (Ctrl+Shift+R) — clean state
- [ ] Phantom on devnet, wallet `3QfHXyf...` connected
- [ ] Browser at 1280×720 (or 1920×1080), zoom 100%
- [ ] Console closed, dock cleaned, no notification clutter
- [ ] Loom in `Cam + Screen` mode, 1080p
- [ ] Mic muted while not narrating, push-to-talk if possible
- [ ] Tabs prepared in this order:
  1. https://tide-dca.vercel.app (landing)
  2. https://tide-dca.vercel.app/admin (operator console)
  3. https://tide-dca.vercel.app/setup (DCA wizard)
  4. https://tide-dca.vercel.app/dashboard (user view)
  5. https://explorer.solana.com/tx/2yCSusUk... (Jupiter CPI proof)

---

## Script (with screen actions)

### 0:00–0:10 — Hook

**Action**: Landing page open. Eyes visible in background. Scroll briefly so judge sees the page.

**Narration**:
> "Solana retail loses about five million dollars a year to MEV bots
> sandwiching their DCA orders. Tide makes the bots blind."

---

### 0:10–0:25 — Problem & solution one-liner

**Action**: Hover over "Comparison" section. The two cards (without/with Tide) visible.

**Narration**:
> "Every solo DCA buy is a sandwich target. Bot sees your transaction
> in the mempool, frontruns to push price up, sells at your inflated
> price. Half a percent slippage per buy.
>
> Tide aggregates encrypted DCA intents inside Arcium MPC. The whole
> pool settles as one Jupiter swap. Bots see one anonymous transaction,
> never your individual order."

---

### 0:25–0:55 — Live mechanism walkthrough

**Action**: Switch to `/admin`. Highlight the lifecycle cards in order.

**Narration**:
> "Here's the operator console — full lifecycle on Solana devnet.
> Init pool with a 15-minute window. Open the window. Mint test USDC.
> User commits an encrypted intent. The window closes. Trigger
> aggregate, execute the swap through Jupiter — and that's a real CPI
> on chain."

**Action**: Click on the **Fetch Raydium Quote** button, wait for response, point at the live route + price impact.

**Narration**:
> "Raydium V3 trade API live, returning a real route. Pyth oracle
> snapshot streaming SOL/USD. The /admin page is also a sponsor demo
> console — every integration is one click away."

---

### 0:55–1:15 — User flow + sponsors

**Action**: Switch to `/dashboard`. Show KPI cards, savings chart, window history.

**Narration**:
> "On the user side: dashboard tracks committed amounts, settled
> windows, savings versus naive DCA. Connect with Phantom or Privy.
> Top up via MoonPay. Idle escrow estimated yield via Reflect. Pool
> authority migration to Squads multisig is one button on the admin
> page."

---

### 1:15–1:30 — Devnet proof

**Action**: Switch to Solana Explorer tab showing the `2yCSusUk` execute_swap transaction. Zoom in on the inner instruction with Jupiter program id.

**Narration**:
> "Seven of seven instructions validated end-to-end on devnet. This is
> the execute_swap transaction — Tide program signs the Jupiter CPI
> via the escrow PDA. Full audit trail in the repo."

---

### 1:25–1:30 — CTA close

**Action**: Switch back to landing. Eyes prominently in background.

**Narration**:
> "Tide. DCA without MEV. Live now on Solana devnet. tide-dca dot
> vercel dot app."

---

## Editing notes

- Cut at sentence boundaries; don't keep "uhm", breath sounds
- Add a 1-second fade-in at start, fade-out at end
- Bottom-right Loom captions: "Built solo for Solana Frontier 2026 (Colosseum)"
- Optional outro card (3 sec): "tide-dca.vercel.app  ·  github.com/PugarHuda/tide-dca"
- Export as 1080p MP4
- Upload to Loom + YouTube; submission form usually accepts both

## Backup (if Anda nervous on first take)

Practice the **first 10 seconds** twice — that's the hook. After that, the rest follows naturally.

If a take goes long (>120s), don't redo from scratch. Edit out the slow parts in Loom — they have a built-in trim tool.

If you flub a word, **pause for 1 second**, repeat the sentence cleanly. Editing keeps the clean take.

## Voice guidance

- **Pace**: ~155 words per minute (slightly faster than conversational, not rushed)
- **Tone**: declarative, certain. Avoid filler "kind of" / "sort of" / "I think"
- **Emphasis**: hit "five million dollars", "Bots blind", "real CPI on chain", "seven of seven"
