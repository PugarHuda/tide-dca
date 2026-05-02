//! Initialize a DCA pool config (admin-only).

use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::error::TideError;
use crate::state::Pool;

const MIN_WINDOW_DURATION: i64 = 60;
const MAX_WINDOW_DURATION: i64 = 86_400;
const MAX_FEE_BPS: u16 = 100;

#[derive(Accounts)]
#[instruction(target_mint: Pubkey)]
pub struct InitPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub input_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = Pool::SPACE,
        seeds = [
            Pool::SEED_PREFIX,
            input_mint.key().as_ref(),
            target_mint.as_ref(),
        ],
        bump,
    )]
    pub pool: Account<'info, Pool>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitPool>,
    target_mint: Pubkey,
    window_duration_seconds: i64,
    min_pool_size_usdc: u64,
    fee_bps: u16,
) -> Result<()> {
    require!(
        window_duration_seconds >= MIN_WINDOW_DURATION
            && window_duration_seconds <= MAX_WINDOW_DURATION,
        TideError::InvalidWindowDuration
    );
    require!(fee_bps <= MAX_FEE_BPS, TideError::InvalidFeeBps);

    let pool = &mut ctx.accounts.pool;
    pool.authority = ctx.accounts.authority.key();
    pool.input_mint = ctx.accounts.input_mint.key();
    pool.target_mint = target_mint;
    pool.window_duration_seconds = window_duration_seconds;
    pool.min_pool_size_usdc = min_pool_size_usdc;
    pool.fee_bps = fee_bps;
    pool.total_volume_processed = 0;
    pool.total_savings_bps_estimated = 0;
    pool.active_window = Pubkey::default();
    pool.window_counter = 0;
    pool.bump = ctx.bumps.pool;

    emit!(PoolInitialized {
        pool: pool.key(),
        input_mint: pool.input_mint,
        target_mint,
        window_duration_seconds,
    });

    Ok(())
}

#[event]
pub struct PoolInitialized {
    pub pool: Pubkey,
    pub input_mint: Pubkey,
    pub target_mint: Pubkey,
    pub window_duration_seconds: i64,
}
