//! Execute aggregate swap via Jupiter IOC route.
//!
//! Called after Arcium MXE returns aggregate result. In production this
//! performs a single atomic USDC → target_mint swap of the entire window
//! escrow via Jupiter Swap CPI with IOC (immediate-or-cancel) flag.
//!
//! NOTE: Jupiter CPI integration is a TODO for the hackathon scope —
//! the swap itself is stubbed (fills `tokens_acquired` from the
//! caller-provided `min_acquired_amount`). What we DO own here:
//! - constraint validation (status must be Aggregating)
//! - lazily creating the output-token escrow ATA so that downstream
//!   `claim_allocation` has a deterministic account to read from
//! - status transition (Aggregating -> Distributed)
//! - pool stats update
//!
//! Production CPI roughly:
//! ```ignore
//! let acquired = jupiter_swap_ioc(
//!     escrow_input_ata,
//!     escrow_output_ata,
//!     pool.target_mint,
//!     window.total_committed_usdc,
//!     min_acquired_amount,
//!     jupiter_route_data,
//! )?;
//! window.tokens_acquired = acquired;
//! ```

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::error::TideError;
use crate::state::{Pool, Window, ESCROW_SEED_PREFIX};

#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [Window::SEED_PREFIX, pool.key().as_ref(), &window.window_number.to_le_bytes()],
        bump = window.bump,
    )]
    pub window: Account<'info, Window>,

    /// Target token mint (e.g. wrapped SOL).
    #[account(constraint = target_mint.key() == pool.target_mint)]
    pub target_mint: Account<'info, Mint>,

    /// CHECK: PDA authority for escrow ATAs (signs transfers in claim_allocation).
    #[account(
        seeds = [ESCROW_SEED_PREFIX, window.key().as_ref(), b"authority"],
        bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    /// Output-token escrow — created lazily here, drained by claim_allocation.
    #[account(
        init_if_needed,
        payer = caller,
        seeds = [ESCROW_SEED_PREFIX, window.key().as_ref(), b"output"],
        bump,
        token::mint = target_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_output_ata: Account<'info, TokenAccount>,

    /// Jupiter program account (placeholder — real CPI loads Jupiter swap accounts list).
    /// CHECK: Jupiter CPI integration TBD; not dereferenced in stub.
    pub jupiter_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<ExecuteSwap>,
    _jupiter_route_data: Vec<u8>,
    min_acquired_amount: u64,
) -> Result<()> {
    let window = &mut ctx.accounts.window;

    require!(window.status == 1, TideError::AggregateNotReady);
    require!(min_acquired_amount > 0, TideError::InvalidAmount);

    // TODO: Jupiter CPI swap execution. See module-level docs for the
    // production shape. For scaffold the caller asserts the expected
    // output amount; in production the CPI return value sets this.
    window.tokens_acquired = min_acquired_amount; // STUB
    window.effective_slippage_bps = 5; // STUB: ~0.05% slippage

    // Status 2 = Executing complete / output escrow funded; claim_allocation
    // accepts both 2 and 3 (Distributed) so users can claim immediately.
    window.status = 2;

    let pool = &mut ctx.accounts.pool;
    pool.total_volume_processed = pool
        .total_volume_processed
        .checked_add(window.total_committed_usdc)
        .ok_or(TideError::Overflow)?;

    emit!(SwapExecuted {
        window: window.key(),
        input_amount: window.total_committed_usdc,
        output_amount: window.tokens_acquired,
        slippage_bps: window.effective_slippage_bps,
    });

    Ok(())
}

#[event]
pub struct SwapExecuted {
    pub window: Pubkey,
    pub input_amount: u64,
    pub output_amount: u64,
    pub slippage_bps: u16,
}
