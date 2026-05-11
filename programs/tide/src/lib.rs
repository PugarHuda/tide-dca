//! Tide — Hidden-Liquidity DCA Pool
//!
//! Recurring DCA pool dengan privacy via Arcium MPC. Encrypted intents,
//! aggregate execute via Jupiter IOC, pro-rata distribute. Retail dapet
//! institutional-grade fills + MEV protection.
//!
//! See `.superstack/idea-context.md` untuk full context.

use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg");

#[program]
pub mod tide {
    use super::*;

    /// Initialize a DCA pool config (admin-only, one-time per token pair).
    pub fn init_pool(
        ctx: Context<InitPool>,
        target_mint: Pubkey,
        window_duration_seconds: i64,
        min_pool_size_usdc: u64,
        fee_bps: u16,
    ) -> Result<()> {
        instructions::init_pool::handler(
            ctx,
            target_mint,
            window_duration_seconds,
            min_pool_size_usdc,
            fee_bps,
        )
    }

    /// Permissionless window creation. Opens a new window for the pool;
    /// must be called between cycles before users can commit intents.
    pub fn init_window(ctx: Context<InitWindow>) -> Result<()> {
        instructions::init_window::handler(ctx)
    }

    /// User sets up recurring DCA position (one per pool per user).
    pub fn setup_dca_position(
        ctx: Context<SetupDcaPosition>,
        amount_per_window: u64,
        max_slippage_bps: u16,
    ) -> Result<()> {
        instructions::setup_dca_position::handler(ctx, amount_per_window, max_slippage_bps)
    }

    /// User commits encrypted intent for current window.
    /// Encryption shares stored di Arcium MXE; only encrypted_intent_hash on-chain.
    pub fn commit_intent(
        ctx: Context<CommitIntent>,
        encrypted_intent_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        instructions::commit_intent::handler(ctx, encrypted_intent_hash, amount)
    }

    /// Permissionless trigger — anyone can call when window expires.
    /// Calls Arcium MXE to compute aggregate, then triggers swap execution.
    pub fn trigger_aggregate(ctx: Context<TriggerAggregate>) -> Result<()> {
        instructions::trigger_aggregate::handler(ctx)
    }

    /// Execute aggregate swap via Jupiter IOC route.
    /// Called after MXE returns AggregateResult.
    pub fn execute_swap(
        ctx: Context<ExecuteSwap>,
        jupiter_route_data: Vec<u8>,
        min_acquired_amount: u64,
    ) -> Result<()> {
        instructions::execute_swap::handler(ctx, jupiter_route_data, min_acquired_amount)
    }

    /// User claims their pro-rata allocation post-execute.
    pub fn claim_allocation(ctx: Context<ClaimAllocation>) -> Result<()> {
        instructions::claim_allocation::handler(ctx)
    }

    /// Pool authority marks an Aggregating window as Failed when the
    /// swap couldn't execute (Jupiter no route, slippage breach, etc).
    /// Unlocks `refund_intent` so users can recover their committed USDC.
    pub fn mark_window_failed(ctx: Context<MarkWindowFailed>) -> Result<()> {
        instructions::mark_window_failed::handler(ctx)
    }

    /// User recovers their commit from a Failed window. The inverse of
    /// `commit_intent` — pulls `intent.amount` USDC from the shared
    /// escrow back to the user's ATA, signed by the escrow_authority PDA.
    pub fn refund_intent(ctx: Context<RefundIntent>) -> Result<()> {
        instructions::refund_intent::handler(ctx)
    }

    /// User closes their settled Intent account to reclaim rent (~0.002
    /// SOL per intent). Only callable after `claim_allocation` or
    /// `refund_intent` has run (intent.claimed == true) — prevents
    /// closing fresh intents and bypassing window aggregate accounting.
    pub fn close_intent(ctx: Context<CloseIntent>) -> Result<()> {
        instructions::close_intent::handler(ctx)
    }
}
