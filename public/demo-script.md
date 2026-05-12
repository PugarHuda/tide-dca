# Tide — Demo Video Script

**Target**: max 3 minutes, screen recording of live product walkthrough at `tide-dca.vercel.app`. Judge sees the product actually works, not slides about it.

**Voice direction**: confident, mid-pace, no filler ("um", "so"). Don't over-explain — let the UI do the showing.

---

## Pre-record checklist

- [ ] Phantom installed + switched to **Devnet**
- [ ] Wallet airdropped some SOL (`solana airdrop 2`)
- [ ] **0 USDC** in wallet (so the "Mint 100 test USDC" CTA shows)
- [ ] Hard reload `tide-dca.vercel.app` (Ctrl+Shift+R) — must serve new bundle `layout-450a240f1ab3494f.js`
- [ ] Close all other browser tabs, hide bookmarks bar, hide extensions toolbar
- [ ] Loom: 1080p, audio source = headphone mic (not laptop), camera off (this is product demo, not talking head)

---

## TIMELINE — 3:00 total

### [0:00–0:15] Cold open · Landing page

**Screen**: tide-dca.vercel.app landing page.
**Action**: scroll once slowly from hero to "How it works" section.

> "This is **Tide** — a hidden-liquidity DCA pool on Solana. Live at `tide-dca.vercel.app`.
>
> Solana retail loses over five million dollars a year to bots front-running their DCA orders. Tide makes them blind. Let me show you how."

---

### [0:15–0:45] /demo · Interactive walkthrough

**Screen**: click "Demo" in nav → `/demo` page loads.
**Action**: click through the 4 steps of the happy-path walkthrough. Then toggle to failure→refund branch.

> "First — `/demo`. No wallet needed. This is the entire mechanism in four steps.
>
> *(click step 1)* Users **encrypt** their amount and slippage client-side using the Arcium SDK. Only the hash hits chain — bots see nothing.
>
> *(click step 2)* The pool **aggregates** all encrypted intents inside an Arcium confidential compute environment. Only the total and participant count come out public.
>
> *(click step 3)* One single **Jupiter v6 swap** executes the full window atomically via PDA-signed CPI.
>
> *(click step 4)* **Pro-rata SOL** distributes back. Users claim. The bots had nothing to front-run.
>
> *(toggle failure branch)* If the swap can't execute — Jupiter no route, network failure — every participant gets a clean refund. No funds at risk."

---

### [0:45–1:30] /setup · Live wallet flow

**Screen**: click "Setup" in nav → `/setup` page.
**Action**:
1. Click "Connect wallet" → Phantom popup → Approve
2. Banner appears: "Mint 100 test USDC" → click it → toast confirms mint
3. Form auto-fills detected USDC balance
4. Set DCA amount: $10, frequency: every window
5. Click "Create DCA position" → Phantom signs → tx confirmation

> "Now the real flow. `/setup`. Connect Phantom on devnet. *(approve)*
>
> Notice the banner — `Mint 100 test USDC`. The pool authority rotates mint rights to any visitor wallet on devnet, so judges don't need to source their own. *(click → toast)* One transaction, USDC in wallet.
>
> *(fill form)* Set my recurring buy at ten dollars per window. Hit `Create position`. Phantom signs. *(tx confirm)* My DCA is now active on-chain — position PDA derived deterministically from my wallet plus pool address."

---

### [1:30–2:15] /dashboard · Commit to live window

**Screen**: click "Dashboard" in nav → `/dashboard` page.
**Action**:
1. Show the live window panel with countdown ("Window #X · closes in 12:34")
2. Show USDC balance and "Commit $10 to current window" button
3. Click commit → Phantom signs → toast confirms
4. Pan to "Position savings vs Jupiter baseline" chart

> "`/dashboard`. There's a live fifteen-minute window running right now. Anyone can commit during the open phase — encrypted intent in, USDC into escrow.
>
> *(click commit)* Sign in Phantom. *(tx confirm)* My intent is committed. When the window closes, the keeper aggregates, executes one Jupiter swap for the whole pool, and pro-rata distributes the SOL.
>
> *(pan to chart)* This panel tracks my fills versus what I'd have gotten on naked Jupiter DCA at the same window times. That delta — the bleed I'm not paying — is what Tide ships."

---

### [2:15–2:50] /admin · Sponsor probes

**Screen**: click "Admin" in nav → `/admin` operator console.
**Action**:
1. Show the 9 probe panels
2. Click "Run all probes" — watch them go green one by one (or already-green from cache)

> "Last route — `/admin`. Operator console. Nine live sponsor probes — each one verifies the integration is actually wired, not faked.
>
> *(click run all)* Arcium SDK — encryption round-trip works. Pyth oracle — SOL/USD price pulled live. Jupiter — quote endpoint returns a real route. Privy verify, Squads create-multisig, Reflect stake, MoonPay currencies, Raydium quote — every surface live and verifiable on demand.
>
> Click any probe and you see the raw response. No mock data."

---

### [2:50–3:00] Close

**Screen**: navigate back to landing or to GitHub README in new tab.

> "`tide-dca.vercel.app`. `github.com/PugarHuda/tide-dca`. Eleven Anchor instructions on devnet. Nine on-chain upgrades during submission day. Public self-audit in `INTEGRITY.md`. Built solo for Solana Frontier. Thank you."

---

## Editing notes (post-record)

- **Trim dead air** between actions. The product runs fast; the video should too.
- **Speed up** Phantom approvals to 1.5x — they're identical every time, judges don't need full duration.
- **Zoom-in callouts** for: program ID on landing, the "Mint 100" toast confirmation, the tx signature in success toast. Loom has built-in zoom-on-click.
- **No music** unless ambient — keep voice clear.
- **End card**: 2 sec static showing `tide-dca.vercel.app` + GitHub URL.

---

# Tide — Pitch Video Script

**Target**: max 2 minutes, founder on camera. Trust signal, not product demo.

**Voice direction**: warmer than demo. Slow down on `solo founder` and `bleed personally`. Look directly at camera at slide-1-equivalent and CTA.

---

## TIMELINE — 2:00 total

### [0:00–0:15] Hook + name

> "Hi. I'm **Pugar Huda Mantoro**. Solo founder from Indonesia. I built **Tide** — DCA without MEV on Solana."

---

### [0:15–0:45] Why this

> "Here's the problem. Solana retail bleeds over five million a year to bots front-running their DCA orders. I know because **I'm one of those users**. I run weekly recurring buys, and I watched my fills bleed through twenty twenty-five.
>
> So I built the fix I wanted: encrypted intents aggregated via Arcium MPC, one atomic Jupiter swap per window, pro-rata distribution. Bots blind. Retail wins."

---

### [0:45–1:15] Why me

> "Three things make me the one to ship this.
>
> **One.** I know the Solana stack deeply — Anchor, Jupiter CPI, Pyth, Privy, Squads. I composed nine sponsor surfaces solo without help.
>
> **Two.** I ship fast and honest. Eleven Anchor instructions on devnet. Nine successful on-chain program upgrades during the submission day alone — each one responding to real test feedback in hours, not weeks.
>
> **Three.** I lead with disclosure. `INTEGRITY.md` in the repo publicly lists every mock, every env-gated component, every gap — before any judge has to ask. That's the culture I run my product with."

---

### [1:15–1:45] What's next

> "Next thirty days: Arcium Cohort Two mainnet acceptance, Ottersec audit prep, ten K bootstrap liquidity.
>
> Six months out: wallet-level integration. I want Phantom and Backpack to embed Tide as their default `Recurring Buy` surface. That's the distribution flywheel — Tide becomes the privacy-default DCA primitive on Solana."

---

### [1:45–2:00] Close

> "**Bots blind. Retail wins.** Tide turns an institutional privacy primitive into a retail one. Help us make it the default.
>
> Thank you."

---

## Recording notes

- **Frame**: 16:9, head-and-shoulders, eye-level camera. Good ring light or window light. Background uncluttered.
- **Wardrobe**: neutral. No logo'd hoodies of competing protocols.
- **Energy**: slightly higher than your normal speaking voice. Smile at hook + CTA.
- **No script reading**: rehearse 3x until you can do it in one take without looking off-screen. Teleprompter OK if positioned at camera level.
- **Cuts allowed**: jump-cuts between sections (0:15 / 0:45 / 1:15 / 1:45) are normal — let editor remove the "okay take two" beats. Don't aim for one-take.

---

# Three videos checklist

| Video | Duration | Where it goes | Status |
|---|---|---|---|
| **Demo video** | ≤3 min | Step 2 form, "Demo video URL" | TODO |
| **Pitch video** | ≤2 min | Step 2 form, "Pitch video URL" (Public field) | TODO |
| **Full deck pitch** | ~4 min | Backup — use during accelerator interview | `pitch.html` ready |

Upload to Loom (preferred) or YouTube Unlisted, paste URL into submission form.
