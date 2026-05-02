//! Custom error codes untuk Tide.

use anchor_lang::prelude::*;

#[error_code]
pub enum TideError {
    #[msg("Pool already initialized")]
    PoolAlreadyInitialized,

    #[msg("Window duration out of bounds (60s - 86400s)")]
    InvalidWindowDuration,

    #[msg("Fee basis points out of bounds (max 100 = 1%)")]
    InvalidFeeBps,

    #[msg("Slippage basis points out of bounds (max 1000 = 10%)")]
    InvalidSlippageBps,

    #[msg("Amount per window must be > 0")]
    InvalidAmount,

    #[msg("DCA position already exists for this pool")]
    PositionAlreadyExists,

    #[msg("DCA position not active")]
    PositionInactive,

    #[msg("Window is not open for commits")]
    WindowClosed,

    #[msg("Window not yet expired")]
    WindowNotExpired,

    #[msg("Window already aggregated")]
    AlreadyAggregated,

    #[msg("Pool size below minimum threshold")]
    PoolTooSmall,

    #[msg("Aggregate result not yet available from MXE")]
    AggregateNotReady,

    #[msg("Swap execution failed")]
    SwapFailed,

    #[msg("Slippage exceeds user's max acceptable")]
    SlippageExceeded,

    #[msg("Allocation already claimed")]
    AlreadyClaimed,

    #[msg("Insufficient balance for commit")]
    InsufficientBalance,

    #[msg("Invalid Jupiter route data")]
    InvalidRouteData,

    #[msg("Arithmetic overflow")]
    Overflow,
}
