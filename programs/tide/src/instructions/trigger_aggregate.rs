//! Permissionless trigger — anyone calls when window expires.
//! Flips window status to "Aggregating" and signals MXE to compute.

use anchor_lang::prelude::*;

use crate::error::TideError;
use crate::state::{Pool, Window};

#[derive(Accounts)]
pub struct TriggerAggregate<'info> {
    pub caller: Signer<'info>,

    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [Window::SEED_PREFIX, pool.key().as_ref(), &window.window_number.to_le_bytes()],
        bump = window.bump,
    )]
    pub window: Account<'info, Window>,
}

pub fn handler(ctx: Context<TriggerAggregate>) -> Result<()> {
    let window = &mut ctx.accounts.window;
    let clock = Clock::get()?;

    require!(
        clock.unix_timestamp >= window.end_ts,
        TideError::WindowNotExpired
    );
    require!(window.status == 0, TideError::AlreadyAggregated);

    // Check pool size threshold
    require!(
        window.total_committed_usdc >= ctx.accounts.pool.min_pool_size_usdc,
        TideError::PoolTooSmall
    );

    // Flip status — signals off-chain MXE to begin aggregate compute
    window.status = 1; // Aggregating

    // TODO: emit cross-program call to Arcium MXE here
    // For scaffold: status flip alone signals indexer to invoke MXE compute.

    emit!(WindowAggregating {
        window: window.key(),
        intent_count: window.intent_count,
        total_committed: window.total_committed_usdc,
    });

    Ok(())
}

#[event]
pub struct WindowAggregating {
    pub window: Pubkey,
    pub intent_count: u32,
    pub total_committed: u64,
}
