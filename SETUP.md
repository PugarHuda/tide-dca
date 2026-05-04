# Tide — Setup Status & Remaining Manual Actions

> Status sebagai 2026-05-03. Menjelaskan apa yang sudah diinstall otomatis vs apa yang masih butuh akun pribadi/email kamu.

---

## ✅ Sudah Otomatis Terinstall

| Tool | Version | Path |
|---|---|---|
| Rust + Cargo | 1.90.0 | `~/.cargo/bin/cargo` |
| Node.js | 22.15.1 | `/c/Program Files/nodejs/node` |
| npm | 10.2.1 | bundled |
| Solana CLI | 3.1.14 (Agave) | `~/.local/share/solana/install/active_release/bin/solana` |
| AVM (Anchor Version Manager) | 1.0.1 | `~/.cargo/bin/avm` |
| Anchor CLI | 0.31.1 | `~/.cargo/bin/anchor` (proxied via avm) |
| Project npm deps (735 packages) | — | `node_modules/` |

### Solana wallet auto-generated
- **Address**: `FvyseLeVrGb1frkscvGJvtiwzrBMyuB54CLMrDaGKbtP`
- **Keypair file**: `C:\Users\ASUS\.config\solana\id.json`
- **Network**: devnet
- **Config**: `C:\Users\ASUS\.config\solana\cli\config.yml`
- ⚠️ **Belum airdrop SOL** — devnet rate-limited saat install. Retry via:
  ```
  solana airdrop 2
  # atau via web faucet: https://faucet.solana.com
  ```

### Tide program keypair generated
- **Program ID**: `HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg`
- **Keypair file**: `target/deploy/tide-keypair.json`
- **Already updated** di:
  - `programs/tide/src/lib.rs` (`declare_id!`)
  - `Anchor.toml` (`[programs.localnet]`, `[programs.devnet]`)

---

## ✅ Build & Test Validation

| Check | Status |
|---|---|
| `npm install` (735 packages) | ✅ Clean |
| `tsc --noEmit` (TypeScript) | ✅ Zero errors |
| `next build` (production) | ✅ All 8 routes static-generated |
| `cargo test` (confidential-ixs Arcis) | ✅ 3/3 unit tests pass |
| `anchor build` (Solana program) | ⏳ See note below |

**Note on `anchor build`**: Two issues mengharuskan user manual intervention:

1. **Anchor 0.31 + Solana 2.1 dep conflict**: zeroize/curve25519-dalek mismatch. **Fixed** dengan downgrade `anchor-spl` ke 0.30.1 di `programs/tide/Cargo.toml`.

2. **Windows non-admin symlink restriction**: `cargo build-sbf` butuh symlinks untuk install platform-tools, fails dengan `os error 1314 (privilege not held)`. **Solutions** (pilih satu):

   **Option A (recommended)**: Enable Windows Developer Mode
   ```
   Settings → System → For developers → Developer Mode: ON
   ```
   Restart terminal. Symlinks now allowed without admin.

   **Option B**: Run elevated PowerShell as administrator
   ```
   Right-click PowerShell → Run as Administrator
   cd "F:\Hackathons\Hackathon Frontier\programs\tide"
   $env:PATH = "C:\Users\ASUS\.local\share\solana\install\active_release\bin;C:\Users\ASUS\.cargo\bin;$env:PATH"
   cargo build-sbf
   ```

   **Option C**: Use WSL2 (full Linux environment)
   ```
   wsl --install
   # then run anchor build inside WSL
   ```

After resolving privilege issue, anchor wrapper PATH issue can be worked around dengan calling `cargo build-sbf` directly:
```powershell
cd "F:\Hackathons\Hackathon Frontier\programs\tide"
$env:PATH = "C:\Users\ASUS\.local\share\solana\install\active_release\bin;C:\Users\ASUS\.cargo\bin;$env:PATH"
cargo build-sbf
# then for IDL generation:
cd ..\..
anchor.exe build --skip-build
```

---

## 🔴 Yang Masih Butuh Manual (Akun Pribadi Kamu)

Ini gak bisa aku otomatisasi karena butuh email/identity verification:

### 1. Helius API Key (5 menit)
**Why**: RPC + DAS API + WebSocket untuk frontend
**Steps**:
1. Buka https://helius.dev
2. Sign up dengan email kamu (gratis tier 100K req/day)
3. Create new app → "Tide DCA"
4. Copy API key
5. Edit `.env.local`:
   ```
   NEXT_PUBLIC_HELIUS_DEVNET_RPC=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
   ```

### 2. Privy App ID (5 menit)
**Why**: Embedded wallet untuk non-crypto user onboarding
**Steps**:
1. Buka https://dashboard.privy.io
2. Sign up
3. Create app "Tide"
4. Copy App ID
5. Edit `.env.local`:
   ```
   NEXT_PUBLIC_PRIVY_APP_ID=your_app_id_here
   ```

### 3. MoonPay Developer Account (10 menit)
**Why**: Fiat → USDC top-up direct ke pool
**Steps**:
1. https://www.moonpay.com/business/developer
2. Apply (might need manual approval, 1-3 days)
3. Get API keys
4. Edit `.env.local`:
   ```
   NEXT_PUBLIC_MOONPAY_API_KEY=
   MOONPAY_SECRET_KEY=
   ```

### 4. Arcium Cohort 2 Application (1-7 days approval)
**Why**: Real Arcium MPC untuk encrypted intents
**Steps**:
1. https://arcium.com/build
2. Apply for Cohort 2 Private Testnet
3. Sebutkan Tide use case di application
4. Wait for approval email
5. Replace `lib/arcium.ts` stubs dengan real `@arcium/client` SDK
6. Deploy `confidential-ixs/src/lib.rs` via `arcium deploy`

### 5. Twitter Handle Registration (5 menit)
**Why**: "Build publicly day 1" mandate
**Steps**:
1. https://twitter.com/signup → register `@tide_dca` (or available variant)
2. First tweet thread:
   ```
   Solana retail loses ~$5M/year to MEV bots sandwiching DCA.
   
   URANI fixed it for whales ($30K Renaissance Grand).
   Archer fixed it for market makers ($10K Cypherpunk).
   
   I'm building Tide — the same mechanism for retail.
   
   Encrypted intents via @ArciumHQ. Aggregate execute via @JupiterExchange.
   Bots blind, retail wins.
   
   Building solo with @AnthropicAI Claude Code.
   Solana Frontier 2026 hackathon.
   
   Beta soon. RT for early access.
   ```
3. Update `.env.example` dan `app/layout.tsx` metadata dengan Twitter handle

### 6. GitHub Public Repo (5 menit)
**Why**: Build publicly evidence + Colosseum submission requirement
**Steps**:
1. https://github.com/new
2. Repo name: `tide-dca` (or available)
3. Public, no README (we have one)
4. Push:
   ```bash
   cd "F:/Hackathons/Hackathon Frontier"
   git remote add origin https://github.com/YOUR_USERNAME/tide-dca.git
   git branch -M main
   git push -u origin main
   ```

### 7. Discord Server (10 menit)
**Why**: Beta tester community + Frontier engagement
**Steps**:
1. Create server "Tide Founders"
2. Channels: `#general`, `#beta-testers`, `#feedback`, `#announcements`
3. Invite link in README + Twitter bio

---

## 📋 Recommended Order of Action

### Hari Ini (~30 menit)
1. **Helius API key** (paling urgent — needed untuk frontend dev)
2. **Solana airdrop retry** (untuk testing wallet)
3. **Try anchor build** (verify program compiles)
4. **`npm run dev`** → http://localhost:3000 (verify frontend live)

### Minggu 1
5. **Privy + GitHub + Twitter**
6. **Arcium Cohort 2 application** (kemungkinan butuh waktu approval)
7. **Daily build-in-public tweets** (per "How to Win" doctrine)

### Minggu 2-3 (real implementation)
8. **MoonPay account** (when needed for top-up flow)
9. **Replace stubs** di `lib/arcium.ts`, `programs/tide/src/instructions/execute_swap.rs`
10. **Real Pyth oracle integration**
11. **Privy embedded wallet** di `lib/providers.tsx`

### Minggu 4 (beta + polish)
12. **Pre-recruit 5-10 beta users** dari crypto Twitter Indo
13. **Bootstrap pool** dengan $10K seed liquidity
14. **Iterate based on beta feedback**

### Minggu 5 (submission)
15. **Demo recording** per `DEMO.md` storyboard
16. **Pitch refinement** per `PITCH.md` blueprint
17. **Submit to Colosseum**

---

## 🚨 PATH Note

Solana CLI di-add ke User-level PATH. **Restart terminal/Claude Code session** untuk PATH ke-load secara otomatis di shell baru. Kalau gak restart, prefix command dengan:

```bash
export PATH="/c/Users/ASUS/.local/share/solana/install/active_release/bin:$PATH"
```

Atau di PowerShell:
```powershell
$env:PATH = "C:\Users\ASUS\.local\share\solana\install\active_release\bin;$env:PATH"
```

---

## 📞 Bantuan Tambahan

Kalau stuck di salah satu step:
- **Helius issue**: support@helius.dev atau Discord https://discord.gg/helius
- **Anchor build issue**: Solana Stack Exchange https://solana.stackexchange.com
- **Arcium**: Discord https://discord.gg/arcium
- **Phantom MCP**: developers@phantom.app

---

## Status File Locations

| File | Purpose |
|---|---|
| `.env.example` | Template — copy ke `.env.local` dan isi |
| `.env.local` | Actual env (gitignored, JANGAN COMMIT) |
| `target/deploy/tide-keypair.json` | Program keypair (generated, gitignored) |
| `~/.config/solana/id.json` | User Solana wallet keypair |
| `~/.config/solana/cli/config.yml` | Solana CLI config |
| `programs/tide/src/lib.rs` | declare_id! sudah update dengan real ID |
| `Anchor.toml` | Program ID sudah update |
