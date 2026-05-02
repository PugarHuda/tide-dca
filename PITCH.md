# Tide — Pitch Deck Outline (3 min Loom)

> Optimized for "How to Win a Colosseum Hackathon" doctrine + judge profile awareness.

---

## Slide 1 — HOOK (0:00-0:20)

**Visual**: Side-by-side screen recording:
- Left: PumpFun retail user DCA $50 → MEV bot sandwiches → 0.5% lost
- Right: 247 Tide users aggregate → single Jupiter IOC → 0.05% slippage

**Voiceover**:
> *"Setiap minggu, satu juta crypto retail user di Solana DCA $50 ke memecoin atau SOL.
> Setiap minggu, MEV bot ambil $0.30 dari mereka. Itu **5 juta dolar per tahun**
> hilang dari retail. URANI fix MEV untuk whales. Archer fix MEV untuk market makers.
> Belum ada yang fix MEV untuk **retail's most common behavior**.
> Itu yang kami bangun."*

**Why this works**: Quantified pain + concrete number ($5M) + acknowledges precedent winners (URANI/Archer) + positions wedge (retail-not-whales).

---

## Slide 2 — THE WEDGE (0:20-0:40)

**Visual**: Architecture diagram (4 phases COMMIT → AGGREGATE → EXECUTE → DISTRIBUTE)

**Voiceover**:
> *"Tide adalah **Hidden-Liquidity DCA Pool**. User encrypt their DCA intent via Arcium MPC.
> Setiap window — say 1 hour — kami aggregate 247 user intents jadi satu trade.
> Single atomic swap via Jupiter IOC. Pro-rata distribute back. Bots blind, retail wins."*

**Critical points to emphasize**:
- "Encrypted intent" (Arcium positioning)
- "Single atomic swap" (MEV protection)
- "Pro-rata distribute" (fairness)

---

## Slide 3 — LIVE DEMO (0:40-1:50)

### Side A — Standalone Jupiter DCA (Pugar's screen)

```
1. Open Jupiter swap UI → schedule $50/week SOL DCA
2. Show pending tx in mempool
3. Show MEV bot frontrun (block X)
4. Show user's tx fills at worse price (block X+1)
5. Show MEV bot backrun (block X+2) → bot profit
6. Calculator: $0.225 lost per week × 52 = $11.70/year per user
```

### Side B — Tide Pool (parallel screen)

```
1. Connect Phantom → /setup → fill DCA wizard
2. Click "Start DCA Pool" → encrypt intent + lock USDC
3. Show /dashboard with WindowStatusCard countdown
4. [TIME SKIP via demo mode] Window closes
5. Show MXE compute simulation (Arcis aggregate)
6. Single Jupiter IOC tx executes — atomic block
7. SavingsChart updates: this week saved $0.225
8. Cumulative chart: 26 weeks → $5.85 saved
9. /dashboard shows pending claim — click "Claim" → SOL arrives wallet
```

**Voiceover during demo**:
> *"Watch left side: bot wins. Watch right side: my $50 buy executes inside an aggregate
> with 246 other users. Bot can't sandwich because it doesn't know the amounts.
> I save 0.45%. Multiply by every retail DCA user → 5 million dollars saved per year."*

---

## Slide 4 — WHY THIS WINS (1:50-2:20)

**Visual**: 3 boxes — URANI, Archer Exchange, Tide

**Voiceover**:
> *"Pattern: URANI won 30K Renaissance Grand Champion dengan intent-based MEV protection.
> Archer Exchange won 10K Cypherpunk dengan batch auctions. Both targeted whales atau market makers.
> Tide applies the same mechanism to retail's most common behavior — recurring buys.
> Built on Arcium for privacy, Jupiter for execution, Phantom for distribution.
> Solo founder, 5 weeks, Claude Code."*

**Subtle pattern signals**:
- "Pattern: URANI / Archer" — show I did winners-research
- "Solo founder + 5 weeks + Claude Code" — set realistic expectation, signals founder grit
- "Built on Arcium" — sponsor signal-direct (Arcium engineers di juri room nod approval)

---

## Slide 5 — VISION + ASK (2:20-3:00)

**Visual**: TAM expansion timeline

**Voiceover**:
> *"Aggregation is the fundamental advantage of institutions over retail.
> Vanguard scaled by aggregating 7 trillion dollars in retail savings.
> They got better fees, better access, better trades. Tide does the same for crypto retail.
> 
> Start with DCA — most common behavior. Expand to portfolio rebalancing,
> yield farming entries, leverage opening. Eventually: every recurring crypto activity
> routes through encrypted private pool. **Vanguard for Solana retail.**
> 
> Try it at tide.fun. Source on github.com/tide-dca.
> Built with Claude Code, ready for Colosseum accelerator interview. Thank you."*

**Closing signal**:
- "Vanguard for Solana retail" = single-line memorable thesis
- "Accelerator interview" = direct hint at Colosseum's 10+ winner pipeline
- "Thank you" close = humble, professional

---

## Speaker Notes & Recording Tips

### Pacing target
- Total: 2:55-3:00 (under 3 min hard cap per Colosseum guidance)
- Buffer 10-15 sec final for "Thank you" + chyron screenshots

### Recording setup
- **Tool**: Loom (per "How to Win" doctrine — Loom > slideshow)
- **Resolution**: 1920×1080
- **Mic**: external mic, ambient noise minimal
- **Background**: clean (Pugar's wall or solid color)
- **Take 5+ takes minimum** before submitting

### Key delivery beats
- Slow down at "5 million dollars per year" — let number land
- Animate energy on demo side-by-side — "watch left… watch right"
- Closing line "Vanguard for Solana retail" — pause 1 sec for emphasis
- No filler words ("uh", "like") — re-record if any

### Visual fail-safes
- **Pre-record 3 versions** of demo with different outcomes (in case live demo fails)
- **Fallback chart** showing seed data if real on-chain data unavailable
- **Screenshots** of full UI prepared as backup slides

---

## Pitch Deck Slides (alternative — for Demo Day pitch later)

If accepted to accelerator:

1. **Title**: "Tide — Vanguard for Solana retail"
2. **Problem**: $5M/year MEV extraction (with chart)
3. **Solution**: Hidden-Liquidity DCA Pool (architecture diagram)
4. **How it works**: 4-phase mechanism (animation)
5. **Demo**: Live or recorded side-by-side
6. **Market**: $80M/month Solana DCA volume → Vanguard analogy ($7T)
7. **Defensibility**: Network effect compounding (more users → bigger pool → better fills)
8. **Tech**: Arcium + Jupiter + Phantom (sponsor-aligned)
9. **Roadmap**: DCA → Rebalancing → Yield entries → "Aggregation infra"
10. **Team**: Pugar Huda Mantoro, solo founder, Indonesia, Claude Code-leveraged
11. **Traction**: Beta users, pool volume, savings demonstrated
12. **Ask**: $250K accelerator entry → 6-month runway, ship multi-token + B2B SDK

---

## Anti-Patterns (avoid these)

❌ Don't open with company name — open with **the pain**
❌ Don't say "we're like X but better" — show side-by-side comparison
❌ Don't show 50 features — show the ONE aha moment
❌ Don't mention "blockchain" generically — reference specific primitives
❌ Don't apologize for being solo — frame Claude Code as advantage
❌ Don't oversell metrics — undersell ("if 1% of retail joins...")
❌ Don't rush — pause for emphasis on key numbers

---

## Judge-Specific Tuning Tips

### For Anatoly Yakovenko / Solana Foundation tier
- Emphasize "ICM thesis" alignment + "Application-Controlled Execution"
- Show technical depth (Arcium MPC + Jupiter IOC)

### For Lily Liu / Asia priority
- "5.5 billion people in capital markets" — Tide onboards retail
- Mention Indonesia/SEA emerging markets

### For Sponsor reps (Arcium, Phantom, Privy)
- Demonstrate DEEP integration, not surface
- Show Arcis function code briefly — they recognize syntax
- Phantom Connect tested live

### For VCs (Foundation Capital, Kosmos, Univ Michigan)
- TAM clear: $80M/month Solana DCA × 30% capture = $24M/month volume
- Defensibility: network effect compounding
- Decade vision: Vanguard analogy resonates

### For past winners (Billy attn.markets, Justin Swig)
- They smell BS — keep demo real, don't fake
- Show working devnet
- Acknowledge complexity honestly
