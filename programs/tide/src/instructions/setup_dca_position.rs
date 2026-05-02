//! User sets up a recurring DCA position (one per pool per user).

use anchor_lang::prelude::*;

use crate::error::TideError;
use crate::state::{DcaPosition, Pool};

const MAX_SLIPPAGE_BPS: u16 = 1000;

#[derive(Accounts)]
pub struct SetupDcaPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub pool: Account<'info, Pool>,

    #[account(
        init,
        payer = owner,
        space = DcaPosition::SPACE,
        seeds = [
            DcaPosition::SEED_PREFIX,
            owner.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump,
    )]
    pub position: Account<'info, DcaPosition>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SetupDcaPosition>,
    amount_per_window: u64,
    max_slippage_bps: u16,
) -> Result<()> {
    require!(amount_per_window > 0, TideError::InvalidAmount);
    require!(
        max_slippage_bps <= MAX_SLIPPAGE_BPS,
        TideError::InvalidSlippageBps
    );

    let position = &mut ctx.accounts.position;
    let clock = Clock::get()?;

    position.owner = ctx.accounts.owner.key();
    position.pool = ctx.accounts.pool.key();
    position.amount_per_window = amount_per_window;
    position.max_slippage_bps = max_slippage_bps;
    position.total_deposited = 0;
    position.total_acquired = 0;
    position.active = true;
    position.created_ts = clock.unix_timestamp;
    position.last_window = 0;
    position.bump = ctx.bumps.position;

    emit!(PositionSetup {
        owner: position.owner,
        pool: position.pool,
        amount_per_window,
        max_slippage_bps,
    });

    Ok(())
}

#[event]
pub struct PositionSetup {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub amount_per_window: u64,
    pub max_slippage_bps: u16,
}
