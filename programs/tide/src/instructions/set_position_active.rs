//! User pauses or resumes their DCA position.
//!
//! The `position.active` flag already gates `commit_intent`
//! (constraint = position.active @ TideError::PositionInactive), so
//! flipping it to false effectively stops future commits without
//! requiring the user to keep manually skipping every window.
//!
//! No funds move here — this is a pure flag flip. Cumulative stats
//! (total_deposited, total_acquired) stay intact for history. User
//! can resume by calling again with active=true.
//!
//! Real stop button for the "Cara stop DCA?" question.

use anchor_lang::prelude::*;

use crate::state::DcaPosition;

#[derive(Accounts)]
pub struct SetPositionActive<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [
            DcaPosition::SEED_PREFIX,
            owner.key().as_ref(),
            position.pool.as_ref(),
        ],
        bump = position.bump,
        constraint = position.owner == owner.key(),
    )]
    pub position: Account<'info, DcaPosition>,
}

pub fn handler(ctx: Context<SetPositionActive>, active: bool) -> Result<()> {
    let position = &mut ctx.accounts.position;
    let was_active = position.active;
    position.active = active;

    emit!(PositionActivityChanged {
        owner: position.owner,
        position: position.key(),
        was_active,
        is_active: active,
    });

    Ok(())
}

#[event]
pub struct PositionActivityChanged {
    pub owner: Pubkey,
    pub position: Pubkey,
    pub was_active: bool,
    pub is_active: bool,
}
