//! User claims their pro-rata token allocation post-execute.

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

use crate::error::TideError;
use crate::state::{DcaPosition, Intent, Window, ESCROW_SEED_PREFIX};

#[derive(Accounts)]
pub struct ClaimAllocation<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [
            Intent::SEED_PREFIX,
            window.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump = intent.bump,
        constraint = intent.owner == owner.key(),
        constraint = !intent.claimed @ TideError::AlreadyClaimed,
    )]
    pub intent: Account<'info, Intent>,

    #[account(
        seeds = [Window::SEED_PREFIX, window.pool.as_ref(), &window.window_number.to_le_bytes()],
        bump = window.bump,
    )]
    pub window: Account<'info, Window>,

    #[account(
        mut,
        seeds = [
            DcaPosition::SEED_PREFIX,
            owner.key().as_ref(),
            window.pool.as_ref(),
        ],
        bump = position.bump,
    )]
    pub position: Account<'info, DcaPosition>,

    /// Escrow target-token ATA (holds output tokens post-execute).
    #[account(
        mut,
        seeds = [ESCROW_SEED_PREFIX, window.key().as_ref(), b"output"],
        bump,
    )]
    pub escrow_output_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA authority
    #[account(
        seeds = [ESCROW_SEED_PREFIX, window.key().as_ref(), b"authority"],
        bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    /// User's target token ATA (receives allocation).
    #[account(mut)]
    pub owner_output_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimAllocation>) -> Result<()> {
    let window = &ctx.accounts.window;
    require!(window.status == 2 || window.status == 3, TideError::AggregateNotReady);

    let intent = &mut ctx.accounts.intent;

    // Compute allocation: pro-rata based on intent.amount / window.total_committed
    // In production: this comes from MXE's compute_distribution result.
    // For scaffold: linear pro-rata calc.
    let allocation = (intent.amount as u128)
        .checked_mul(window.tokens_acquired as u128)
        .and_then(|v| v.checked_div(window.total_committed_usdc as u128))
        .ok_or(TideError::Overflow)? as u64;

    intent.allocated_amount = allocation;
    intent.claimed = true;

    // Transfer from escrow to user
    let window_key = window.key();
    let seeds: &[&[u8]] = &[
        ESCROW_SEED_PREFIX,
        window_key.as_ref(),
        b"authority",
        &[ctx.bumps.escrow_authority],
    ];
    let signer_seeds = &[seeds];

    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_output_ata.to_account_info(),
        to: ctx.accounts.owner_output_ata.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds),
        allocation,
    )?;

    // Update position cumulative
    let position = &mut ctx.accounts.position;
    position.total_acquired = position
        .total_acquired
        .checked_add(allocation)
        .ok_or(TideError::Overflow)?;

    emit!(AllocationClaimed {
        owner: intent.owner,
        window: window.key(),
        allocation,
    });

    Ok(())
}

#[event]
pub struct AllocationClaimed {
    pub owner: Pubkey,
    pub window: Pubkey,
    pub allocation: u64,
}
