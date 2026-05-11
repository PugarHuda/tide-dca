//! User closes their settled Intent account to reclaim rent.
//!
//! After `claim_allocation` (Distributed) or `refund_intent` (Failed), the
//! Intent account has done its job — `intent.claimed = true` and no
//! further on-chain reads of it are needed. Closing it via Anchor's
//! `close = owner` constraint sweeps the rent-exempt balance back to the
//! owner's lamport account (~0.002 SOL per intent, but multiplies over
//! many DCA cycles).
//!
//! Safety:
//!   - Only the original Intent owner can close it (PDA seed-binding)
//!   - Intent must be `claimed` (i.e. claim_allocation or refund_intent
//!     has run) — prevents users from closing fresh intents and
//!     bypassing the window aggregate accounting
//!
//! Not callable on:
//!   - Intents with `claimed = false` (commit still pending settlement)
//!   - Intents that don't belong to the signer

use anchor_lang::prelude::*;

use crate::error::TideError;
use crate::state::{Intent, Window};

#[derive(Accounts)]
pub struct CloseIntent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [Window::SEED_PREFIX, window.pool.as_ref(), &window.window_number.to_le_bytes()],
        bump = window.bump,
    )]
    pub window: Account<'info, Window>,

    #[account(
        mut,
        close = owner,
        seeds = [
            Intent::SEED_PREFIX,
            window.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump = intent.bump,
        constraint = intent.owner == owner.key(),
        constraint = intent.claimed @ TideError::AggregateNotReady,
    )]
    pub intent: Account<'info, Intent>,
}

pub fn handler(_ctx: Context<CloseIntent>) -> Result<()> {
    // `close = owner` constraint above handles the rent transfer; nothing
    // else to do. Emit an event for indexers tracking lifecycle completion.
    Ok(())
}
