//! User recovers their commit from a Failed window.
//!
//! When `mark_window_failed` has set window.status=3, every user with an
//! Intent on that window can call this to pull their original USDC back
//! out of escrow. The reverse of `commit_intent` — escrow_input_ata
//! → owner_input_ata, signed by the escrow_authority PDA, for the
//! exact `intent.amount`.
//!
//! Safety invariants:
//!   - Window must be in Failed (status=3) state
//!   - Intent must belong to the signer
//!   - Intent must not be already claimed/refunded (`intent.claimed`)
//!   - The same `intent.claimed` flag is reused so a user cannot
//!     both refund AND claim a single Intent — exclusive paths
//!
//! Escrow accounting: each `commit_intent` deposited `intent.amount`
//! USDC into the shared `escrow_input_ata`. Since `execute_swap` never
//! ran (that's the Failed precondition), the escrow still holds the
//! full sum of all commits. Refunding one user `intent.amount` leaves
//! the remainder for everyone else to refund. After every user refunds,
//! escrow is drained to 0.

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

use crate::error::TideError;
use crate::state::{Intent, Window, ESCROW_SEED_PREFIX};

#[derive(Accounts)]
pub struct RefundIntent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub input_mint: Account<'info, Mint>,

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
        associated_token::mint = input_mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_input_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for escrow. Same custom PDA used everywhere.
    #[account(
        seeds = [ESCROW_SEED_PREFIX, window.key().as_ref(), b"authority"],
        bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = input_mint,
        token::authority = owner,
    )]
    pub owner_input_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RefundIntent>) -> Result<()> {
    let window = &ctx.accounts.window;
    require!(window.status == 3, TideError::SwapFailed);

    let intent = &mut ctx.accounts.intent;
    let amount = intent.amount;
    intent.claimed = true;

    let window_key = window.key();
    let seeds: &[&[u8]] = &[
        ESCROW_SEED_PREFIX,
        window_key.as_ref(),
        b"authority",
        &[ctx.bumps.escrow_authority],
    ];
    let signer_seeds = &[seeds];

    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_input_ata.to_account_info(),
        to: ctx.accounts.owner_input_ata.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds),
        amount,
    )?;

    emit!(IntentRefunded {
        owner: intent.owner,
        window: window.key(),
        amount,
    });

    Ok(())
}

#[event]
pub struct IntentRefunded {
    pub owner: Pubkey,
    pub window: Pubkey,
    pub amount: u64,
}
