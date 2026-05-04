//! Execute aggregate swap via Jupiter route.
//!
//! Called after Arcium MXE returns the aggregate result. The caller (any
//! signer) fetches a Jupiter swap-instructions response off-chain, packs the
//! resulting accounts into `remaining_accounts` and the instruction data into
//! `jupiter_route_data`, then invokes here. We forward the call as a CPI
//! signed by the `escrow_authority` PDA so Jupiter can drain the input
//! escrow USDC into the output escrow target token.
//!
//! Output is measured by reloading `escrow_output_ata` post-CPI and diffing
//! the token balance — Jupiter doesn't return a value.
//!
//! Slippage enforcement: callers pass `min_acquired_amount` as their floor;
//! anything below reverts `SlippageExceeded`. Match this to the Jupiter
//! quote's `otherAmountThreshold` for honest enforcement.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::error::TideError;
use crate::state::{Pool, Window, ESCROW_SEED_PREFIX};

#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [Window::SEED_PREFIX, pool.key().as_ref(), &window.window_number.to_le_bytes()],
        bump = window.bump,
    )]
    pub window: Account<'info, Window>,

    /// Input mint (USDC). Must match pool.input_mint.
    #[account(constraint = input_mint.key() == pool.input_mint)]
    pub input_mint: Account<'info, Mint>,

    /// Target token mint (e.g. wrapped SOL). Must match pool.target_mint.
    #[account(constraint = target_mint.key() == pool.target_mint)]
    pub target_mint: Account<'info, Mint>,

    /// CHECK: PDA authority for escrow ATAs. Signs the Jupiter CPI so the swap
    /// can pull from `escrow_input_ata`.
    #[account(
        seeds = [ESCROW_SEED_PREFIX, window.key().as_ref(), b"authority"],
        bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    /// Input-token escrow (USDC). Funded during commit_intent. Standard ATA.
    #[account(
        mut,
        associated_token::mint = input_mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_input_ata: Account<'info, TokenAccount>,

    /// Output-token escrow — created lazily here, drained by claim_allocation.
    #[account(
        init_if_needed,
        payer = caller,
        associated_token::mint = target_mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_output_ata: Account<'info, TokenAccount>,

    /// CHECK: Jupiter swap program. Verified loosely — we forward the CPI to
    /// whatever the caller provides; the rest of the account list (passed via
    /// `remaining_accounts`) is what Jupiter validates internally.
    pub jupiter_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<ExecuteSwap>,
    jupiter_route_data: Vec<u8>,
    min_acquired_amount: u64,
) -> Result<()> {
    let window = &mut ctx.accounts.window;

    require!(window.status == 1, TideError::AggregateNotReady);
    require!(min_acquired_amount > 0, TideError::InvalidAmount);
    require!(!jupiter_route_data.is_empty(), TideError::InvalidRouteData);

    // ── Build Jupiter CPI from caller-provided remaining_accounts ──
    //
    // Each entry mirrors the Jupiter `swapInstruction.accounts` shape; we just
    // cast AccountInfo -> AccountMeta for the underlying invoke.
    let cpi_accounts: Vec<AccountMeta> = ctx
        .remaining_accounts
        .iter()
        .map(|acc| {
            if acc.is_writable {
                AccountMeta::new(*acc.key, acc.is_signer)
            } else {
                AccountMeta::new_readonly(*acc.key, acc.is_signer)
            }
        })
        .collect();

    let cpi_ix = Instruction {
        program_id: ctx.accounts.jupiter_program.key(),
        accounts: cpi_accounts,
        data: jupiter_route_data,
    };

    // PDA-sign as escrow_authority — its bump is auto-derived by Anchor from
    // the seed constraint on the account above.
    let window_key = window.key();
    let authority_bump = ctx.bumps.escrow_authority;
    let signer_seeds: &[&[u8]] = &[
        ESCROW_SEED_PREFIX,
        window_key.as_ref(),
        b"authority",
        &[authority_bump],
    ];

    let pre_balance = ctx.accounts.escrow_output_ata.amount;
    let pre_input_balance = ctx.accounts.escrow_input_ata.amount;

    invoke_signed(&cpi_ix, ctx.remaining_accounts, &[signer_seeds])?;

    // Refresh both escrow accounts so we can measure flow.
    ctx.accounts.escrow_output_ata.reload()?;
    ctx.accounts.escrow_input_ata.reload()?;

    let post_balance = ctx.accounts.escrow_output_ata.amount;
    let acquired = post_balance
        .checked_sub(pre_balance)
        .ok_or(TideError::SwapFailed)?;
    require!(acquired >= min_acquired_amount, TideError::SlippageExceeded);

    let input_consumed = pre_input_balance
        .checked_sub(ctx.accounts.escrow_input_ata.amount)
        .ok_or(TideError::SwapFailed)?;

    // Effective slippage bps approximation: 1 - (acquired / expected_acquired)
    // We don't have spot oracle here so we treat min_acquired_amount as the
    // user-asserted floor and report slippage relative to that floor.
    let effective_slippage_bps: u16 = if acquired > min_acquired_amount {
        // We did better than floor — report 0.
        0
    } else {
        // acquired <= min_acquired_amount; require! above already enforced ==,
        // so this branch only runs when acquired == min_acquired_amount.
        0
    };

    window.tokens_acquired = acquired;
    window.effective_slippage_bps = effective_slippage_bps;
    window.status = 2; // Distributed-ready (claim_allocation may proceed)

    let pool = &mut ctx.accounts.pool;
    pool.total_volume_processed = pool
        .total_volume_processed
        .checked_add(input_consumed)
        .ok_or(TideError::Overflow)?;

    emit!(SwapExecuted {
        window: window.key(),
        input_amount: input_consumed,
        output_amount: acquired,
        slippage_bps: effective_slippage_bps,
    });

    Ok(())
}

#[event]
pub struct SwapExecuted {
    pub window: Pubkey,
    pub input_amount: u64,
    pub output_amount: u64,
    pub slippage_bps: u16,
}
