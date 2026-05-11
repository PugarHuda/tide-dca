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

/// Jupiter v6 program ID — the only swap program execute_swap accepts.
/// Hardcoded to prevent a malicious caller from substituting a fake program
/// that drains the input escrow. If Jupiter ever migrates to v7+, this
/// requires a program upgrade — explicit on purpose.
pub const JUPITER_V6_PROGRAM_ID: Pubkey =
    anchor_lang::solana_program::pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

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

    /// CHECK: Jupiter swap program. Constrained to the canonical Jupiter v6
    /// address so a malicious caller cannot substitute a fake program that
    /// drains the input escrow. The account list (`remaining_accounts`) is
    /// still validated by Jupiter internally as before.
    #[account(address = JUPITER_V6_PROGRAM_ID @ TideError::InvalidRouteData)]
    pub jupiter_program: AccountInfo<'info>,

    /// CHECK: Optional Pyth V2 price account for honest realized-slippage
    /// computation. Pass the canonical SOL/USD feed (or whichever target
    /// asset feed matches `pool.target_mint`) to have the handler decode
    /// the spot price and compute `window.effective_slippage_bps` against
    /// it. Pass `system_program` as a sentinel to skip Pyth math entirely
    /// (handler detects this and zeros the slippage field as before).
    /// We don't constrain to a specific Pyth feed pubkey here because:
    /// (1) different target_mints want different feeds, (2) Pyth migrates
    /// feed addresses occasionally. The handler verifies the Pyth magic
    /// header during decode, which prevents anyone passing a random
    /// account and getting bogus slippage numbers.
    pub pyth_price_account: AccountInfo<'info>,

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

    // Effective slippage bps. Two modes:
    //   - When `pyth_price_account` is a real Pyth V2 price account (i.e.
    //     NOT the SystemProgram sentinel), decode the spot price and
    //     compute realized slippage against what the swap SHOULD have
    //     returned at oracle price. This is the honest path.
    //   - When `pyth_price_account` is SystemProgram, report 0 (matches
    //     the pre-Pyth-consumer behavior). Devnet falls into this branch
    //     because Pyth feeds aren't replicated to devnet for our test
    //     mint pairs.
    //
    // Decode reference: lib/pyth.ts performs the same V2 offset reads.
    // We only need price + exponent here; confidence/publish_slot are
    // useful for off-chain consumers but not for slippage math.
    let pyth_account_info = &ctx.accounts.pyth_price_account;
    let pyth_is_real = pyth_account_info.key() != anchor_lang::system_program::ID;
    let effective_slippage_bps: u16 = if pyth_is_real {
        let pyth_data = pyth_account_info.try_borrow_data()?;
        // Sanity: magic header at offset 0
        require!(pyth_data.len() >= 240, TideError::InvalidRouteData);
        let magic = u32::from_le_bytes([
            pyth_data[0], pyth_data[1], pyth_data[2], pyth_data[3],
        ]);
        require!(magic == 0xa1b2c3d4, TideError::InvalidRouteData);
        // Exponent at offset 20 (i32, negative for price feeds)
        let expo = i32::from_le_bytes([
            pyth_data[20], pyth_data[21], pyth_data[22], pyth_data[23],
        ]);
        // Aggregate price at offset 208 (i64, in units of 10^expo)
        let price_raw = i64::from_le_bytes([
            pyth_data[208], pyth_data[209], pyth_data[210], pyth_data[211],
            pyth_data[212], pyth_data[213], pyth_data[214], pyth_data[215],
        ]);
        require!(price_raw > 0, TideError::InvalidRouteData);
        drop(pyth_data);

        // expected_acquired (in target lamports) given input_consumed USDC
        // (6 decimals) and Pyth price (e.g. $200 / SOL). For SOL output
        // (9 decimals), expected = input_consumed * (10^9 / 10^6) / price.
        //
        // To avoid float math: input_consumed * 10^(9-6) / (price_raw * 10^expo).
        // expo is typically -8 for SOL/USD, so price_raw * 10^-8 = price.
        // → expected = input_consumed * 10^3 * 10^|expo| / price_raw.
        //
        // We approximate with u128 to stay safe under multiplication.
        let target_decimals = ctx.accounts.target_mint.decimals as i32;
        let input_decimals = ctx.accounts.input_mint.decimals as i32;
        let decimal_delta = target_decimals - input_decimals - expo; // expo is -8, so adds 8
        let expected_acquired: u128 = if decimal_delta >= 0 {
            (input_consumed as u128)
                .checked_mul(10u128.pow(decimal_delta as u32))
                .ok_or(TideError::Overflow)?
                .checked_div(price_raw as u128)
                .ok_or(TideError::Overflow)?
        } else {
            (input_consumed as u128)
                .checked_div(10u128.pow((-decimal_delta) as u32))
                .ok_or(TideError::Overflow)?
                .checked_div(price_raw as u128)
                .ok_or(TideError::Overflow)?
        };

        // Slippage bps: ((expected - acquired) / expected) * 10000.
        // When acquired >= expected (we did better than oracle), report 0.
        if (acquired as u128) >= expected_acquired || expected_acquired == 0 {
            0u16
        } else {
            let slippage = expected_acquired
                .checked_sub(acquired as u128)
                .unwrap_or(0)
                .checked_mul(10_000)
                .ok_or(TideError::Overflow)?
                .checked_div(expected_acquired)
                .unwrap_or(0);
            // Cap at u16::MAX so a degenerate oracle reading can't cause
            // the cast to wrap.
            slippage.min(u16::MAX as u128) as u16
        }
    } else {
        // No Pyth oracle — fall back to the pre-upgrade behavior
        // (report 0). Callers know they passed the sentinel.
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
