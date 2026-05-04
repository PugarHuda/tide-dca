# Tide — Demo Recording Storyboard

> Detailed shot-by-shot guide for Loom recording. Use this as checklist during recording session.

---

## MVP Demo Path — what we can record TODAY (~90s)

The full storyboard below assumes ~5 beta users, real Arcium MXE, and a polished
landing page. None of those are gated by code anymore — just by deployment +
external-account wait. This section is the runnable subset for a hackathon
submission cut **today** off the current `master` branch.

### Hard pre-reqs (one-time, ~15 min)

1. Windows Developer Mode ON (see DEPLOY.md "Build")
2. `anchor build && anchor deploy --provider.cluster devnet` — see DEPLOY.md
3. Confirm `solana balance` ≥ 0.5 SOL (post-deploy ~0.3 SOL leftover is plenty)
4. `npm run dev` open at http://localhost:3000

### Recording script (90 seconds, single take)

| t | beat | action |
|---|---|---|
| 0:00 | hook | Title card: "DCA without MEV. Bots blind, retail wins." |
| 0:08 | problem | "Solana retail loses ~$5M/year to bots sandwiching DCA." (1 sentence over screen recording of jup.ag DCA flow) |
| 0:18 | nav to /admin | Connect Phantom (devnet). Page shows "No Pool account" empty state. |
| 0:23 | init_pool | Click **Initialize Pool** → Phantom signs → Solana Explorer link appears. Pool state card now shows authority + counter=0. |
| 0:35 | init_window | Click **Open Next Window** → signs → Window #0 created, end_ts ~1h ahead. |
| 0:43 | nav to /setup | Switch to second wallet (Phantom multi-account or Solflare). Fill form: $50, 1h, 1%. Click **Start DCA Pool** → tx confirmed. |
| 0:58 | nav to /dashboard | Real numbers: Total deposited 0 (no commit_intent UI yet — call out as "next iteration"), position is Active, countdown live. |
| 1:08 | nav to /admin (back to admin wallet) | Click **Trigger Aggregate** (window may need to be expired in production; for demo we either fast-forward window or note this). |
| 1:18 | execute_swap | Click **Execute Swap** → Jupiter route fetched → v0 tx with ALT signs → Solana Explorer shows the actual Jupiter CPI hit. |
| 1:28 | close | "Privacy via Arcium. Aggregate via Jupiter. Distribution via Phantom. Solo founder, 5 weeks, Claude Code." |

### What we DON'T claim in the MVP cut

Be honest in the voiceover — judges respect this:

- **Arcium MPC**: encryption layer is the stub at `lib/arcium.ts`. Real MXE
  pending Cohort 2 approval. Show the *UX* of encrypted commit but call it
  "designed for Arcium" not "powered by Arcium today."
- **commit_intent UI**: there's no user-facing commit page yet — only
  setup_dca_position. The aggregation demo runs against the pool/window
  primitives directly via /admin. State this explicitly.
- **Beta users**: numbers shown are 1 (you). Don't fabricate "247 participants."

### Recording mechanics

- **Two browser profiles** so wallet switches don't require disconnect dance.
  Profile A = pool authority. Profile B = end user.
- **Trim ruthlessly** — anything that's not on the script above gets cut.
  90 seconds buys ~12 distinct beats; we have 10. No room for slack.
- **Inset terminal** showing tx signatures in `solana confirm <sig>` adds
  technical legitimacy in 1-2 visible cuts.

---

## Pre-Recording Checklist

### Setup
- [ ] Phantom wallet on devnet, funded with 1 SOL + 1000 USDC (devnet)
- [ ] Tide deployed to devnet, program ID confirmed working
- [ ] Pool initialized (`anchor migrate` ran successfully)
- [ ] Frontend running (`npm run dev` → localhost:3000)
- [ ] At least 5 beta users have committed intents (so window has real participants)
- [ ] Two browser windows open side-by-side (stage left = Jupiter, stage right = Tide)

### Recording tools
- [ ] Loom Pro (allows >5 min recording, 4K quality)
- [ ] Headphone mic (external, not laptop built-in)
- [ ] Quiet room, lights on, no notifications
- [ ] Browser zoom to 110% for readability
- [ ] DevTools closed unless specifically needed

### Backup
- [ ] Pre-recorded backup of 3 different demo outcomes (success, partial, failure scenarios)
- [ ] Screenshots of each key UI state (in case live fails)

---

## Shot List

### Shot 1 (0:00-0:08) — Opening Title Card

**On screen**: Black slide with cyan text:
```
TIDE
DCA without MEV.
Bots blind, retail wins.

Solana Frontier 2026
Solo founder · Built with Claude Code
```

**Voiceover**: silent for first 2 sec, then start hook.

---

### Shot 2 (0:08-0:30) — The Pain (Hook)

**On screen**: Switch to live Jupiter swap interface, simulate retail DCA.

**Steps**:
1. Open jup.ag (right side of screen)
2. Show DCA setup: $50 USDC → SOL, weekly recurring
3. Confirm
4. Show mempool: pending tx visible (use solscan or blockchain explorer in tab)
5. Animate: bot frontruns (highlight bot tx) → user tx fills → bot backruns
6. Show calculator overlay: "$0.225 lost this week × 52 weeks = $11.70/year"

**Voiceover**:
> *"Watch this. Solana retail user DCA $50 a week. Standard Jupiter route.
> Watch the mempool. Bot sees the order. Bot frontruns. User pays 0.5% extra.
> Bot dumps. Pocket $0.225. Multiply by 1 million retail users on Solana.
> $5 million per year. Extracted from people who just want to invest $50/week."*

**Visual emphasis**:
- Highlight bot tx with red border
- Highlight extra cost in red large font
- Background music: subtle, building tension

---

### Shot 3 (0:30-0:50) — The Solution Overview

**On screen**: Switch to Tide landing page.

**Steps**:
1. Show /tide.fun (or localhost) landing page
2. Scroll past hero to "How it works" 4-step section
3. Hover over each step briefly

**Voiceover**:
> *"This is Tide. Hidden-Liquidity DCA Pool.
> You encrypt your intent. Pool aggregates 247 users. Single atomic swap.
> Bots see only ciphertext. Pro-rata distribution. Mathematically fair."*

---

### Shot 4 (0:50-1:30) — Live Setup Flow

**On screen**: User journey through /setup wizard.

**Steps**:
1. Click "Start DCA →" → routes to /setup
2. Connect Phantom wallet (modal opens, click Phantom)
3. Wallet connected, address shown in nav
4. Setup form visible
5. Fill: target = SOL, amount = 50 USDC, window = 1h, slippage = 1%
6. Show estimated savings calculator: "$5.85/year saved"
7. Click "Start DCA Pool"
8. Phantom popup → sign tx
9. Tx confirmation: "Encrypted. Locked $50 in escrow."
10. Auto-redirect to /dashboard

**Voiceover**:
> *"Phantom connect, fill the form, click start. My intent is encrypted via Arcium.
> Specific amount of $50 — only I know it. Bots see ciphertext.
> Pool growing. We have 246 other users at this hour. Total pool: $12,400."*

---

### Shot 5 (1:30-2:00) — Window Lifecycle

**On screen**: /dashboard with countdown.

**Steps**:
1. WindowStatusCard visible: 30:00 countdown, $12.4K pool, 247 participants
2. Speed up demo time (use demo mode toggle if implemented, otherwise jump cut)
3. Countdown reaches 0:00 → status flips to "Aggregating (MPC)"
4. Show keeper logs in terminal (small inset window)
5. Status flips to "Distributed" → big checkmark animation
6. Cumulative SavingsChart updates with new data point
7. Pending claim banner appears: "0.198 SOL ready to claim"
8. Click "Claim" → Phantom popup → sign → SOL arrives in wallet

**Voiceover**:
> *"Window closes. Arcium MPC computes the aggregate. Single Jupiter IOC swap executes.
> Look at the slippage: 0.05%. Standalone would be 0.5%. **Ten times better fill.**
> Pro-rata distributes. I claim my 0.198 SOL. Saved $0.22 this hour.
> Times 24 hours, times 365 days, my chart looks like this."*

---

### Shot 6 (2:00-2:30) — Pattern Match (Why This Wins)

**On screen**: Three logos in a row — URANI, Archer Exchange, Tide.

**Steps**:
1. Brief callout to URANI: "$30K Renaissance Grand"
2. Brief callout to Archer: "$10K Cypherpunk"
3. Tide positioned: "$5M/year retail savings"

**Voiceover**:
> *"This isn't theory. URANI won the Renaissance Grand Champion with intent-based
> MEV protection — for whales. Archer Exchange won Cypherpunk with batch auctions —
> for market makers. Tide applies the same mechanism to retail's
> most common behavior: recurring buys.
> Built on Arcium for privacy. Jupiter for execution. Phantom for distribution.
> Solo founder, 5 weeks, Claude Code."*

---

### Shot 7 (2:30-2:55) — Vision + Close

**On screen**: TAM expansion timeline graphic.

**Steps**:
1. Show timeline: Year 1 DCA → Year 2 Rebalancing → Year 3 Yield → Year 5 "Aggregation infra"
2. Vanguard logo overlay → arrow → Tide logo
3. End screen: "tide.fun · github.com/tide-dca · @tide_dca"

**Voiceover**:
> *"Vanguard scaled by aggregating $7 trillion in retail savings.
> They got better fees, better trades. Tide does the same for crypto retail.
> Vanguard for Solana retail. Try it at tide.fun.
> Source on github.com/tide-dca. Ready for Colosseum accelerator interview."*

---

### Shot 8 (2:55-3:00) — Final Frame

**On screen**: Logo + thank you.

**Voiceover**:
> *"Thank you."*

---

## Recording Day Checklist

Day before:
- [ ] Caffeine intake managed
- [ ] Practice runs: 5+ takes
- [ ] Final script memorized (not read from teleprompter)
- [ ] All technical state working (devnet pool, frontend, demo data)

Day of:
- [ ] Quiet space confirmed
- [ ] Mic test recording
- [ ] Loom Pro session started (4K, 60fps)
- [ ] Take 1: full run-through (probably bad)
- [ ] Take 2-5: refine each segment
- [ ] Take 6+: final composite
- [ ] Review final cut with friend before submission
- [ ] Trim to <3:00 hard cap

Day after:
- [ ] Upload to Loom (public link)
- [ ] Embed on submission page
- [ ] Tweet thread with Loom link

---

## Common Demo Failures + Mitigations

| Failure mode | Mitigation |
|---|---|
| Phantom wallet rejection | Pre-fund test wallet, ensure devnet config |
| Jupiter API rate limit | Cache responses, use multiple test wallets |
| Tide tx confirmation slow | Pre-warm RPC, use Helius private endpoint |
| Window doesn't close on time | Keeper running pre-recording, time tracking |
| MXE compute fails | Pre-record this segment as backup |
| Browser crash | Have second machine ready |
| Mic dies | Backup mic + recording on phone too |

---

## Post-Demo Distribution

### Hour 0-1
- Twitter thread linking Loom + GitHub
- Discord #share-projects
- Crypto Twitter friends DM

### Hour 1-24
- Reach out to known judges via Twitter (subtle, not spam)
- Cross-post to Solana Foundation Discord
- Share in Indo crypto communities

### Day 1-7
- Track view count + feedback
- Iterate if obvious issues
- Re-record if major flaw found

---

## Loom Description Template

```
Tide — Hidden-Liquidity DCA Pool for Solana retail.

Encrypted intents via Arcium MPC. Aggregate execute via Jupiter IOC.
Pro-rata distribute. Bots blind, retail wins.

Built solo with Claude Code for Solana Frontier 2026.

→ Try it: https://tide.fun
→ Source: https://github.com/tide-dca
→ Twitter: @tide_dca

Sponsor stack: @ArciumHQ + @phantom + @privy_io + @MoonPay + @reflectprotocol
```

---

## Submission Checklist (Day of Hackathon Submission)

- [ ] Loom video uploaded + URL tested
- [ ] GitHub repo public + README polished
- [ ] Live deployment on tide.fun (Vercel)
- [ ] Devnet program deployed + working
- [ ] Documentation complete (CLAUDE.md, README, .superstack/)
- [ ] At least 5 actual users in beta (real signups)
- [ ] At least 10 windows successfully completed
- [ ] Total volume in beta period: $X (fill with real number)
- [ ] Twitter active for 4+ weeks (build publicly evidence)
- [ ] Discord with active members (community)
- [ ] Submission form filled completely on Colosseum platform
