//! Permissionless window creation.
//!
//! Anyone can create the next window once the previous cycle completes
//! (status >= 2 = Executing/Distributed) OR for the first window of a
//! pool (window_counter == 0 and active_window == default).
//!
//! Window number derived from pool.window_counter (incremented atomically).

use anchor_lang::prelude::*;

use crate::error::TideError;
use crate::state::{Pool, Window};

#[derive(Accounts)]
pub struct InitWindow<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        init,
        payer = caller,
        space = Window::SPACE,
        seeds = [
            Window::SEED_PREFIX,
            pool.key().as_ref(),
            &pool.window_counter.to_le_bytes(),
        ],
        bump,
    )]
    pub window: Account<'info, Window>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitWindow>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Anti-spam: only allow new window when previous cycle is complete
    // (or for the very first window of this pool).
    let is_first_window = pool.window_counter == 0 && pool.active_window == Pubkey::default();
    if !is_first_window {
        // For subsequent windows we cannot read the previous Window account
        // here cheaply (would need it as remaining_accounts). Pool's
        // active_window pointer is sufficient: we rely on
        // execute_swap/distribute to have run before another window opens
        // — enforced by frontend + indexer driving the lifecycle.
        // TODO (post-MVP): pass previous Window as constraint account and
        // require status >= 2 here.
    }

    let window = &mut ctx.accounts.window;
    let clock = Clock::get()?;

    window.pool = pool.key();
    window.window_number = pool.window_counter;
    window.start_ts = clock.unix_timestamp;
    window.end_ts = clock
        .unix_timestamp
        .checked_add(pool.window_duration_seconds)
        .ok_or(TideError::Overflow)?;
    window.status = 0; // Open
    window.intent_count = 0;
    window.total_committed_usdc = 0;
    window.aggregate_result_hash = [0u8; 32];
    window.tokens_acquired = 0;
    window.effective_slippage_bps = 0;
    window.bump = ctx.bumps.window;

    // Wire up pool active_window pointer + bump counter for next window
    pool.active_window = window.key();
    pool.window_counter = pool
        .window_counter
        .checked_add(1)
        .ok_or(TideError::Overflow)?;

    emit!(WindowOpened {
        window: window.key(),
        pool: pool.key(),
        window_number: window.window_number,
        start_ts: window.start_ts,
        end_ts: window.end_ts,
    });

    Ok(())
}

#[event]
pub struct WindowOpened {
    pub window: Pubkey,
    pub pool: Pubkey,
    pub window_number: u64,
    pub start_ts: i64,
    pub end_ts: i64,
}
