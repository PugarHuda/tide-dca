//! User commits encrypted intent for current window.
//!
//! Flow:
//! 1. User encrypts {amount, target, max_slippage} via Arcium client SDK
//! 2. Submits encrypted_intent_hash + visible amount to escrow
//! 3. Encryption shares stored in Arcium MXE (off-chain)
//! 4. Aggregate computation runs at window close (trigger_aggregate)

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

use crate::error::TideError;
use crate::state::{DcaPosition, Intent, Pool, Window, ESCROW_SEED_PREFIX};

#[derive(Accounts)]
#[instruction(encrypted_intent_hash: [u8; 32])]
pub struct CommitIntent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [
            DcaPosition::SEED_PREFIX,
            owner.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump = position.bump,
        constraint = position.active @ TideError::PositionInactive,
    )]
    pub position: Account<'info, DcaPosition>,

    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [Window::SEED_PREFIX, pool.key().as_ref(), &window.window_number.to_le_bytes()],
        bump = window.bump,
        constraint = window.status == 0 @ TideError::WindowClosed,
    )]
    pub window: Account<'info, Window>,

    #[account(
        init,
        payer = owner,
        space = Intent::SPACE,
        seeds = [
            Intent::SEED_PREFIX,
            window.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump,
    )]
    pub intent: Account<'info, Intent>,

    /// USDC mint (input).
    pub input_mint: Account<'info, Mint>,

    /// User's USDC token account.
    #[account(
        mut,
        token::mint = input_mint,
        token::authority = owner,
    )]
    pub owner_input_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for escrow ATAs.
    #[account(
        seeds = [ESCROW_SEED_PREFIX, window.key().as_ref(), b"authority"],
        bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    /// Pool USDC escrow — standard ATA so Jupiter / external programs can
    /// resolve it via getAssociatedTokenAddress.
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = input_mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_input_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CommitIntent>,
    encrypted_intent_hash: [u8; 32],
    amount: u64,
) -> Result<()> {
    require!(amount > 0, TideError::InvalidAmount);

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < ctx.accounts.window.end_ts,
        TideError::WindowClosed
    );

    // Transfer USDC to escrow
    let cpi_accounts = Transfer {
        from: ctx.accounts.owner_input_ata.to_account_info(),
        to: ctx.accounts.escrow_input_ata.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

    // Initialize Intent record
    let intent = &mut ctx.accounts.intent;
    intent.owner = ctx.accounts.owner.key();
    intent.window = ctx.accounts.window.key();
    intent.encrypted_intent_hash = encrypted_intent_hash;
    intent.amount = amount;
    intent.allocated_amount = 0;
    intent.claimed = false;
    intent.bump = ctx.bumps.intent;

    // Update Window aggregates
    let window = &mut ctx.accounts.window;
    window.intent_count = window
        .intent_count
        .checked_add(1)
        .ok_or(TideError::Overflow)?;
    window.total_committed_usdc = window
        .total_committed_usdc
        .checked_add(amount)
        .ok_or(TideError::Overflow)?;

    // Update DcaPosition cumulative
    let position = &mut ctx.accounts.position;
    position.total_deposited = position
        .total_deposited
        .checked_add(amount)
        .ok_or(TideError::Overflow)?;
    position.last_window = window.window_number;

    emit!(IntentCommitted {
        intent: intent.key(),
        window: window.key(),
        owner: intent.owner,
        amount,
    });

    Ok(())
}

#[event]
pub struct IntentCommitted {
    pub intent: Pubkey,
    pub window: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}
