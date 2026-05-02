//! Tide Arcium MXE — Confidential Aggregate Compute
//!
//! Two confidential functions:
//! 1. `aggregate_intents`: sum encrypted user intents → public total + count
//! 2. `compute_distribution`: pro-rata allocate acquired tokens → encrypted shares
//!
//! Strategy: individual amounts NEVER decrypt. Only aggregate stats public.
//! Pro-rata distributions stay encrypted per-user; user decrypts their own share.

// use arcis_sdk::prelude::*;

/// Encrypted user intent (committed via Arcium client SDK).
/// In Arcis, fields would be `m{type}` (masked types).
#[derive(Clone)]
pub struct EncryptedIntent {
    /// Amount in USDC lamports (6 decimals). Encrypted as `mu64`.
    pub amount: u64,
    /// Max acceptable slippage in basis points. Encrypted as `mu16`.
    pub max_slippage_bps: u16,
    /// User's nullifier (anti-double-commit).
    pub nullifier: [u8; 32],
}

/// Aggregate result decrypted publicly (only summary stats, not individuals).
#[derive(Clone)]
pub struct AggregateResult {
    /// Total USDC committed across all participants.
    pub total_amount: u64,
    /// Number of unique participants.
    pub participant_count: u32,
    /// Average max slippage (weighted by amount).
    pub weighted_avg_slippage_bps: u16,
}

/// Per-user allocation result (encrypted, only user can decrypt their own).
#[derive(Clone)]
pub struct EncryptedAllocation {
    /// Allocation in target token lamports. Encrypted as `mu64`.
    pub allocated_amount: u64,
    /// User's nullifier (matches their intent).
    pub nullifier: [u8; 32],
}

/// Confidential function 1: aggregate encrypted intents.
///
/// In Arcis, this would be marked `#[confidential]` and run on MPC nodes.
/// Inputs are encrypted shares; only the AggregateResult decrypts publicly.
pub fn aggregate_intents(intents: &[EncryptedIntent]) -> AggregateResult {
    let mut total: u64 = 0;
    let mut weighted_slippage: u128 = 0;
    let mut count: u32 = 0;

    for intent in intents {
        total = total.saturating_add(intent.amount);
        weighted_slippage = weighted_slippage
            .saturating_add((intent.amount as u128) * (intent.max_slippage_bps as u128));
        count = count.saturating_add(1);
    }

    let weighted_avg_slippage_bps = if total > 0 {
        (weighted_slippage / (total as u128)) as u16
    } else {
        0
    };

    AggregateResult {
        total_amount: total,
        participant_count: count,
        weighted_avg_slippage_bps,
    }
}

/// Confidential function 2: compute pro-rata distribution.
///
/// Given:
/// - Encrypted intents (individual amounts hidden)
/// - Total tokens acquired from aggregate swap (public)
/// - Total amount that was committed (from aggregate_intents result, public)
///
/// Returns encrypted allocations per user (each user decrypts their own share).
pub fn compute_distribution(
    intents: &[EncryptedIntent],
    total_tokens_acquired: u64,
    total_committed: u64,
) -> Vec<EncryptedAllocation> {
    if total_committed == 0 {
        return vec![];
    }

    intents
        .iter()
        .map(|intent| {
            let allocation = ((intent.amount as u128) * (total_tokens_acquired as u128))
                / (total_committed as u128);

            EncryptedAllocation {
                allocated_amount: allocation as u64,
                nullifier: intent.nullifier,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_intent(amount: u64, slippage_bps: u16, nullifier_byte: u8) -> EncryptedIntent {
        EncryptedIntent {
            amount,
            max_slippage_bps: slippage_bps,
            nullifier: [nullifier_byte; 32],
        }
    }

    #[test]
    fn test_aggregate_three_users() {
        let intents = vec![
            mk_intent(20_000_000, 100, 1), // 20 USDC
            mk_intent(5_000_000, 50, 2),   // 5 USDC
            mk_intent(100_000_000, 80, 3), // 100 USDC
        ];

        let result = aggregate_intents(&intents);
        assert_eq!(result.total_amount, 125_000_000);
        assert_eq!(result.participant_count, 3);
        // Weighted avg slippage = (20*100 + 5*50 + 100*80) / 125 = (2000+250+8000)/125 = 82
        assert_eq!(result.weighted_avg_slippage_bps, 82);
    }

    #[test]
    fn test_distribution_pro_rata() {
        let intents = vec![
            mk_intent(20_000_000, 100, 1),
            mk_intent(5_000_000, 50, 2),
            mk_intent(100_000_000, 80, 3),
        ];

        let total_committed = 125_000_000;
        // Suppose acquired 1.25 SOL (1_250_000_000 lamports SOL)
        let acquired = 1_250_000_000;

        let allocations = compute_distribution(&intents, acquired, total_committed);
        assert_eq!(allocations.len(), 3);

        // User 1: 20/125 of 1.25 = 0.2 SOL = 200_000_000 lamports
        assert_eq!(allocations[0].allocated_amount, 200_000_000);
        // User 2: 5/125 of 1.25 = 0.05 SOL = 50_000_000
        assert_eq!(allocations[1].allocated_amount, 50_000_000);
        // User 3: 100/125 of 1.25 = 1.0 SOL = 1_000_000_000
        assert_eq!(allocations[2].allocated_amount, 1_000_000_000);

        // Sum should equal total acquired (modulo rounding)
        let sum: u64 = allocations.iter().map(|a| a.allocated_amount).sum();
        assert_eq!(sum, acquired);
    }

    #[test]
    fn test_empty_intents() {
        let intents: Vec<EncryptedIntent> = vec![];
        let result = aggregate_intents(&intents);
        assert_eq!(result.total_amount, 0);
        assert_eq!(result.participant_count, 0);
    }
}
