//! Mark a window as Failed when the swap can't execute OR when an
//! empty window expired without any commits.
//!
//! Triggered by the pool authority when:
//!   - status=1 (Aggregating): swap impossible (Jupiter no route, etc).
//!     Standard escape hatch — unlocks refund_intent for participants.
//!   - status=0 (Open) AND expired AND empty: no commits arrived before
//!     window closed. Without this branch the lifecycle guard added in
//!     upgrade #6 (`init_window` requires prev.status ≥ 2) would lock
//!     the pool permanently — no one can open the next window because
//!     the previous one is stuck in Open. Authority can sweep it to
//!     Failed so the lifecycle advances.
//!
//! Status guards:
//!   - status=2 Distributed: NEVER — users may have unclaimed allocations
//!   - status=3 Failed: idempotent no-op via the status check
//!
//! Funds invariant: status=1→3 transitions a window that received
//! commits, leaving USDC in escrow for refund_intent recovery.
//! status=0→3 transitions an empty window with no funds to recover.
//! Either way, no value is destroyed.

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

    // Case 1: Aggregating window — standard escape hatch.
    // Case 2: Open + expired + empty — unstick lifecycle when no commits
    //         arrived. Empty check is critical: must NEVER let authority
    //         skip a window with active commits, that'd freeze user funds.
    let is_aggregating = window.status == 1;
    let clock = Clock::get()?;
    let is_open_expired_empty = window.status == 0
        && clock.unix_timestamp >= window.end_ts
        && window.intent_count == 0
        && window.total_committed_usdc == 0;

    require!(
        is_aggregating || is_open_expired_empty,
        TideError::AggregateNotReady
    );

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
