//! Permissionless window creation with lifecycle guard.
//!
//! Anyone can create the next window once the previous cycle is in a
//! terminal state — Distributed (2) or Failed (3) — OR for the very
//! first window of a pool (window_counter == 0). The previous window
//! is passed as `previous_window` (Optional via remaining_accounts
//! pattern would be cleaner, but optional account types tighten the
//! Anchor IDL story so we require it explicitly except for the first
//! window where it's passed as the Pool itself as a sentinel).
//!
//! Closing the 5th audit finding from internal review on 2026-05-11.
//! Previously the lifecycle guard was a TODO comment; orphan windows
//! could be opened mid-flight by any caller, which threatens the
//! pool's `active_window` pointer integrity. Now: any caller wanting
//! to advance past an Aggregating window must first call
//! `mark_window_failed` (pool authority) to reach the Failed terminal
//! state, then init_window can proceed.

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

    /// CHECK: Previous window for lifecycle-guard. Must satisfy ONE of:
    ///   - First window of pool (window_counter == 0): pass anything,
    ///     handler will skip the read
    ///   - Subsequent: must equal pool.active_window AND have status
    ///     in {2, 3} (Distributed | Failed)
    /// The validation runs inside the handler instead of as an Anchor
    /// `constraint =` to avoid the stack-frame access violation pattern
    /// that bit us during the input_mint constraint refactor (see
    /// commit_intent.rs comment around line 60).
    #[account(mut)]
    pub previous_window: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitWindow>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Lifecycle guard: only allow new window when the previous cycle is
    // in a terminal state. First window of the pool is exempt (no
    // previous window to check). The previous_window account is passed
    // in but only read for window_counter > 0.
    let is_first_window = pool.window_counter == 0 && pool.active_window == Pubkey::default();
    if !is_first_window {
        // The previous window must match the pool's active_window pointer
        // AND its on-chain status must be terminal (2=Distributed or
        // 3=Failed). The handler reads previous_window's data directly to
        // avoid the Anchor `constraint =` stack-pressure pattern.
        require!(
            ctx.accounts.previous_window.key() == pool.active_window,
            TideError::AggregateNotReady
        );
        // Deserialize the previous window's `status` byte. Anchor account
        // layout: 8-byte discriminator + 32 bytes pool + 8 bytes
        // window_number + 8 bytes start_ts + 8 bytes end_ts + 1 byte
        // status. Status byte is at offset 64.
        let data = ctx.accounts.previous_window.try_borrow_data()?;
        require!(data.len() >= 65, TideError::AggregateNotReady);
        let prev_status = data[64];
        // Reject Open (0) and Aggregating (1); accept Distributed (2),
        // Failed (3). The cycle MUST settle before another window opens.
        require!(
            prev_status == 2 || prev_status == 3,
            TideError::AggregateNotReady
        );
        drop(data); // release borrow before pool/window mutation below
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
