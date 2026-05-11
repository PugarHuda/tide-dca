//! Mark an aggregating window as Failed when the swap can't execute.
//!
//! Triggered by the pool authority when Jupiter has no route, slippage
//! exceeds tolerance, or any other condition makes `execute_swap`
//! impossible. Setting status=3 unlocks `refund_intent` so users can
//! recover their committed USDC instead of being permanently stuck.
//!
//! Only Aggregating (status=1) windows can be failed. Open (0) windows
//! should expire and be aggregated first (or aborted at the off-chain
//! coordinator layer). Distributed (2) windows already completed — no
//! refund path. Already-Failed (3) windows are no-ops.

use anchor_lang::prelude::*;

use crate::error::TideError;
use crate::state::{Pool, Window};

#[derive(Accounts)]
pub struct MarkWindowFailed<'info> {
    pub authority: Signer<'info>,

    #[account(constraint = pool.authority == authority.key() @ TideError::PoolAlreadyInitialized)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [Window::SEED_PREFIX, pool.key().as_ref(), &window.window_number.to_le_bytes()],
        bump = window.bump,
        constraint = window.pool == pool.key(),
    )]
    pub window: Account<'info, Window>,
}

pub fn handler(ctx: Context<MarkWindowFailed>) -> Result<()> {
    let window = &mut ctx.accounts.window;
    require!(window.status == 1, TideError::AggregateNotReady);
    window.status = 3; // Failed

    emit!(WindowFailed {
        window: window.key(),
        window_number: window.window_number,
    });

    Ok(())
}

#[event]
pub struct WindowFailed {
    pub window: Pubkey,
    pub window_number: u64,
}
