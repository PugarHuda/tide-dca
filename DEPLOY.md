# Tide — Deployment Runbook

> Step-by-step from "code compiles" to "first DCA position created on devnet."
> Companion to `SETUP.md` (which covers initial environment setup).

---

## Pre-flight Checks

Run these before attempting `anchor deploy`. They take ~30s total.

| Check | Command | Pass criterion |
|---|---|---|
| Program ID consistent | `grep -h CLMop5kyE programs/tide/src/lib.rs Anchor.toml .env.local` | All three lines match `CLMop5kyE4jqnca98eZVrs5nc93HSVdT13xqARtSH2GZ` |
| Solana wallet has balance | `solana balance` | ≥ 2 SOL (deploy costs ~1.4 SOL on devnet) |
| Cluster set to devnet | `solana config get` | `RPC URL: https://api.devnet.solana.com` |
| Anchor CLI matches lib | `anchor --version`, `grep anchor-lang programs/tide/Cargo.toml` | Both 0.31.1 |
| `cargo check` passes | `cd programs/tide && cargo check` | `Finished dev profile`, no errors |

If any fail, fix before proceeding — `anchor deploy` consumes SOL on every attempt.

---

## 1. Build (BPF target)

`anchor build` requires `cargo-build-sbf` to install Solana platform-tools, which on
Windows needs symlink permission. Without it, build silently produces no IDL.

**Required**: enable Windows Developer Mode once.

```
Settings → System → For developers → Developer mode: ON
```

Then restart terminal so the privilege change takes effect.

```bash
cd "F:\Hackathons\Hackathon Frontier"
anchor build
```

Expected output ends with `To deploy this program: ...`. After success:

- `target/deploy/tide.so`        — BPF program binary (~200 KB)
- `target/idl/tide.json`         — Anchor IDL (instructions, accounts, errors)
- `target/types/tide.ts`         — TypeScript types regenerated from IDL

If `anchor build` fails on platform-tools, see `SETUP.md` Section "anchor build" for Option A/B/C fallbacks.

---

## 2. Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

Watch for `Program Id: CLMop5kyE...` (must match `lib/constants.ts` and `.env.local`).

Common failure: `insufficient funds for fee` — top up:

```bash
solana airdrop 2
# or web faucet: https://faucet.solana.com
```

If a previous deploy left the program in an inconsistent upgrade state (rare),
close + redeploy:

```bash
solana program close CLMop5kyE4jqnca98eZVrs5nc93HSVdT13xqARtSH2GZ --bypass-warning
anchor deploy --provider.cluster devnet
```

---

## 3. Verify Deployment

```bash
solana program show CLMop5kyE4jqnca98eZVrs5nc93HSVdT13xqARtSH2GZ \
  --url https://api.devnet.solana.com
```

Expected fields:
- `Program Id` matches
- `Owner: BPFLoaderUpgradeab1e11111111111111111111111`
- `Authority` = your local wallet
- `Last Deployed In Slot` recent

Cross-check on Solana Explorer:
`https://explorer.solana.com/address/CLMop5kyE4jqnca98eZVrs5nc93HSVdT13xqARtSH2GZ?cluster=devnet`

---

## 4. Initialize on-chain state (`/admin` page)

The frontend exposes an operator console for the two bootstrap calls. Both
sign with the connected wallet, so connect Phantom (or whatever owns the
upgrade authority) before clicking.

```bash
npm run dev
# open http://localhost:3000/admin
```

1. **init_pool** — one-time. Creates the canonical USDC -> SOL Pool PDA with
   defaults (1 h windows, 100 USDC minimum, 5 bps fee). After success the page
   auto-locks this button ("Pool already exists") and unlocks init_window.

2. **init_window** — opens window #N for new commits. The button reads
   `pool.windowCounter` so it always derives the correct PDA. Anyone can call
   this between cycles; in production a cron will hit the same instruction.

Both actions render a Solana Explorer link on success — keep one open as proof
for the demo.

---

## 5. End-to-end Smoke Test

With Pool + Window initialized, exercise the user flow:

1. `/setup` — connect a *different* wallet (so you're acting as a user, not the
   pool authority), fill the form (e.g. `$50 / 60 min / 1% slippage`), submit.
   Look for `✓ DCA position created` with explorer link. **First DCA position
   created on devnet** ✓

2. `/dashboard` — same wallet should now see real position numbers, the
   active-window countdown, and an empty pending-claim card.

3. (Optional, requires Jupiter integration which is currently stubbed) trigger
   `execute_swap` after window expiry → claim button appears → click Claim →
   verify wrapped SOL in user's ATA.

Until Jupiter CPI ships, claim_allocation will fail at runtime even though the
button is wired — the output escrow has no balance.

---

## 6. Mainnet Readiness Checklist

Not for the hackathon. Capture for after-submission planning.

- [ ] Audit (~$15-30K, 2-4 weeks) — Ottersec, Halborn, or Sec3
- [ ] Real Jupiter Swap CPI in `execute_swap` (replace `min_acquired_amount` stub)
- [ ] Real Arcium MXE for `compute_distribution` (replace pro-rata fallback)
- [ ] Pyth oracle wiring for window-time price reference
- [ ] Bug bounty (Immunefi, ~$50-100K critical bounty)
- [ ] Per-user position cap + circuit breakers
- [ ] Mainnet program-id keypair stored offline
- [ ] Upgrade authority migrated to multisig (Squads V4)
- [ ] Mainnet USDC (`EPjFW...`) wired in `constants.ts`

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `cargo build-sbf: privilege not held` | Dev Mode off | Enable Dev Mode + restart terminal |
| `anchor build` finishes but no `target/idl/tide.json` | Build failed silently mid-compile | Check `cargo check` first; look for warnings about deprecated APIs |
| `Program Id mismatch` after deploy | Stale `target/deploy/tide-keypair.json` | Delete `target/deploy/`, regenerate, rebuild, redeploy |
| `Account not found` on init_pool | USDC mint pubkey wrong for cluster | Verify `USDC_MINT_DEVNET` in `lib/constants.ts` matches the actual devnet USDC |
| `init_window` fails with `Pool not initialized` | UI cached pool=null | Hard-refresh browser; `usePool()` resubscribes on mount |
| Frontend HTTP 500 with `Can't resolve '@solana-program/memo'` | Privy peer dep missing | `npm i @solana-program/memo --legacy-peer-deps` |
