//! Account structures untuk Tide.

use anchor_lang::prelude::*;

/// Pool config — one per (input_mint, output_mint) pair.
#[account]
pub struct Pool {
    /// Authority yang dapat update config.
    pub authority: Pubkey,
    /// Input token mint (typically USDC).
    pub input_mint: Pubkey,
    /// Target token mint (e.g., SOL, JUP, JTO).
    pub target_mint: Pubkey,
    /// Window duration (seconds). E.g., 3600 = 1 hour.
    pub window_duration_seconds: i64,
    /// Minimum pool size to trigger aggregate (fallback if too small).
    pub min_pool_size_usdc: u64,
    /// Protocol fee on aggregate volume (basis points). Max 100 (1%).
    pub fee_bps: u16,
    /// Total cumulative volume processed (for stats).
    pub total_volume_processed: u64,
    /// Total cumulative MEV savings vs spot (estimated, in basis points).
    pub total_savings_bps_estimated: u64,
    /// Currently active window account.
    pub active_window: Pubkey,
    /// Window counter (monotonically increasing).
    pub window_counter: u64,
    /// Bump seed.
    pub bump: u8,
}

impl Pool {
    pub const SEED_PREFIX: &'static [u8] = b"pool";
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 2 + 8 + 8 + 32 + 8 + 1 + 16; // padding
}

/// User's recurring DCA position per pool.
#[account]
pub struct DcaPosition {
    /// Owner wallet.
    pub owner: Pubkey,
    /// Associated pool.
    pub pool: Pubkey,
    /// Amount to spend per window (USDC lamports = 6 decimals).
    pub amount_per_window: u64,
    /// Max acceptable slippage in basis points.
    pub max_slippage_bps: u16,
    /// Total amount deposited cumulative.
    pub total_deposited: u64,
    /// Total target token acquired cumulative.
    pub total_acquired: u64,
    /// Active flag (user can pause/resume).
    pub active: bool,
    /// Created timestamp.
    pub created_ts: i64,
    /// Last window participated.
    pub last_window: u64,
    /// Bump seed.
    pub bump: u8,
}

impl DcaPosition {
    pub const SEED_PREFIX: &'static [u8] = b"dca-position";
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 2 + 8 + 8 + 1 + 8 + 8 + 1 + 8;
}

/// Window account — represents one aggregation cycle.
#[account]
pub struct Window {
    /// Pool this window belongs to.
    pub pool: Pubkey,
    /// Window number (monotonic, matches Pool::window_counter at creation).
    pub window_number: u64,
    /// Start timestamp.
    pub start_ts: i64,
    /// End timestamp (window closes for new commits).
    pub end_ts: i64,
    /// Status: 0=Open (commits accepted), 1=Aggregating (MXE compute),
    ///         2=Executing (swap pending), 3=Distributed (complete)
    pub status: u8,
    /// Number of intents committed.
    pub intent_count: u32,
    /// Total USDC committed (visible aggregate, not individual).
    pub total_committed_usdc: u64,
    /// MXE aggregate result hash (set after MXE returns).
    pub aggregate_result_hash: [u8; 32],
    /// Total target tokens acquired (set after execute).
    pub tokens_acquired: u64,
    /// Effective slippage (basis points, set after execute).
    pub effective_slippage_bps: u16,
    /// Bump seed.
    pub bump: u8,
}

impl Window {
    pub const SEED_PREFIX: &'static [u8] = b"window";
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 1 + 4 + 8 + 32 + 8 + 2 + 1 + 16;
}

/// User's intent for a specific window (committed via Arcium encryption).
#[account]
pub struct Intent {
    /// User wallet.
    pub owner: Pubkey,
    /// Window participated in.
    pub window: Pubkey,
    /// Hash of encrypted intent stored in Arcium MXE.
    pub encrypted_intent_hash: [u8; 32],
    /// Amount committed (visible — only specific amount hidden in MXE shares).
    /// Note: amount visible on-chain BUT individual amount within aggregate
    /// pool is hidden via MXE compute shares for sandwich resistance.
    pub amount: u64,
    /// Allocated tokens (set post-distribute, encrypted-derived).
    pub allocated_amount: u64,
    /// Claimed flag.
    pub claimed: bool,
    /// Bump seed.
    pub bump: u8,
}

impl Intent {
    pub const SEED_PREFIX: &'static [u8] = b"intent";
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 1 + 8;
}

/// Escrow PDA seeds — holds USDC during commit window + target tokens post-execute.
pub const ESCROW_SEED_PREFIX: &[u8] = b"escrow";
