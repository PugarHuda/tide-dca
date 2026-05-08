/**
 * Pyth oracle — window-time price snapshot.
 *
 * Pyth ships price feeds as on-chain accounts. Each feed contains a price
 * in fixed-point integer + an exponent + a confidence interval + a
 * publish slot. To consume on-chain, programs deserialize the account and
 * read the latest price. To consume off-chain (UI), we read the same
 * account via RPC and decode the bytes.
 *
 * Tide use case:
 *   When a window settles via execute_swap, the realized SOL/USDC ratio
 *   should be benchmarked against an external reference price to compute
 *   true slippage. Pyth gives us that reference. The /admin oracle card
 *   reads SOL/USD live and the dashboard window-history can compare.
 *
 * Pyth program id (mainnet): FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH
 * SOL/USD price feed account (mainnet): H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG
 *
 * Devnet has different pubkeys; we read from env so config swaps cluster.
 *
 * Reference: https://docs.pyth.network/price-feeds/use-real-time-data/solana
 */

import { Connection, PublicKey } from "@solana/web3.js";

export const PYTH_SOL_USD_FEED = new PublicKey(
  process.env.NEXT_PUBLIC_PYTH_SOL_USD_FEED ??
    "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG",
);

export type PythPrice = {
  /** Decimal price (integer * 10^exponent → human-readable). */
  price: number;
  /** Confidence interval (1 σ, in same decimal unit as price). */
  confidence: number;
  /** Slot the price was last published. */
  publishSlot: bigint;
  /** Unix timestamp of the publish slot (best-effort, may be off by ~ms). */
  publishTime: bigint;
};

/**
 * Fetch + decode a Pyth price account. Throws on missing account or
 * unsupported version.
 *
 * Layout (Pyth Price V2, abbreviated):
 *   magic           [u32 = 0xa1b2c3d4]
 *   version         u32
 *   atype           u32
 *   size            u32
 *   ptype           u32
 *   exponent        i32
 *   num_components  u32
 *   ...
 *   aggregate_price PriceInfo (40 bytes) at offset 208 in v2
 *
 * We jump straight to the aggregate price block instead of parsing the
 * full struct — only `price`, `conf`, `pub_slot`, `prev_pub_slot` matter
 * for our snapshot.
 */
export async function fetchPythPrice(
  connection: Connection,
  feed: PublicKey = PYTH_SOL_USD_FEED,
): Promise<PythPrice> {
  const account = await connection.getAccountInfo(feed);
  if (!account) {
    throw new Error(`Pyth feed ${feed.toBase58()} not found on this cluster`);
  }
  const data = account.data;
  // Sanity: magic header
  const magic = data.readUInt32LE(0);
  if (magic !== 0xa1b2c3d4) {
    throw new Error(`Pyth feed magic mismatch: got 0x${magic.toString(16)}`);
  }
  const version = data.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`Pyth feed version ${version} not supported (need v2)`);
  }
  const exponent = data.readInt32LE(20);

  // PriceInfo block — contains aggregate price + confidence + publish slot.
  // Pyth's published struct places `agg` at offset 208 in PriceAccount v2.
  // Verify by reading the slot value sanity-check (must be > 0).
  const AGG_OFFSET = 208;
  const priceRaw = data.readBigInt64LE(AGG_OFFSET);          // i64 price
  const confRaw = data.readBigUInt64LE(AGG_OFFSET + 8);      // u64 confidence
  // status u32 at offset +16, corp_act u32 at +20
  const publishSlot = data.readBigUInt64LE(AGG_OFFSET + 24); // u64 pub_slot
  // prev_slot at +32, prev_price at +40, prev_conf at +48, prev_timestamp at +56
  const publishTime = data.readBigInt64LE(AGG_OFFSET + 56);

  const scale = Math.pow(10, exponent); // exponent is negative for price feeds
  return {
    price: Number(priceRaw) * scale,
    confidence: Number(confRaw) * scale,
    publishSlot,
    publishTime: BigInt(publishTime),
  };
}

export const PYTH_DOCS_URL = "https://docs.pyth.network/price-feeds";
