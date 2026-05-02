//! Execute aggregate swap via Jupiter IOC route.
//!
//! Called after Arcium MXE returns aggregate result. Performs single
//! atomic swap of total escrowed USDC → target token.
//!
//! TODO: integrate Jupiter Swap CPI. Currently scaffold validates and
//! flips status. Real Jupiter CPI requires Jupiter program account list.

use anchor_lang::prelude::*;

use crate::error::TideError;
use crate::state::{Pool, Window};

#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
    pub caller: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [Window::SEED_PREFIX, pool.key().as_ref(), &window.window_number.to_le_bytes()],
        bump = window.bump,
    )]
    pub window: Account<'info, Window>,

    /// Jupiter program account (placeholder — load with Jupiter swap accounts in production)
    /// CHECK: jupiter swap CPI integration TBD
    pub jupiter_program: AccountInfo<'info>,
}

pub fn handler(
    ctx: Context<ExecuteSwap>,
    _jupiter_route_data: Vec<u8>,
    min_acquired_amount: u64,
) -> Result<()> {
    let window = &mut ctx.accounts.window;

    require!(window.status == 1, TideError::AggregateNotReady);
    require!(min_acquired_amount > 0, TideError::InvalidAmount);

    // TODO: Jupiter CPI swap execution here
    // Pseudo-flow:
    //   let acquired = jupiter_swap_ioc(
    //     escrow_input_ata,
    //     pool.target_mint,
    //     window.total_committed_usdc,
    //     min_acquired_amount,
    //     jupiter_route_data,
    //   )?;
    //   window.tokens_acquired = acquired;

    // For scaffold — placeholder values
    window.tokens_acquired = min_acquired_amount; // STUB
    window.effective_slippage_bps = 5; // STUB: 0.05% slippage achieved
    window.status = 2; // Executing -> Distributed

    // Update pool stats
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
