/**
 * Anchor account decoders for Tide.
 *
 * Anchor stores accounts as `[8-byte discriminator][Borsh fields]` where
 * the discriminator is `sha256("account:<PascalName>")[..8]`. Field layout
 * mirrors programs/tide/src/state.rs exactly.
 *
 * We hand-roll these instead of using @coral-xyz/anchor's BorshAccountsCoder
 * because IDL generation is blocked by Windows symlink restriction (see
 * project memory). Once `anchor build` works, this module can be deleted in
 * favor of `program.account.<name>.fetch()`.
 */

import { sha256 } from "@noble/hashes/sha256";
import { PublicKey } from "@solana/web3.js";

import type { DcaPosition, Intent, Pool, Window } from "./types";

const POOL_DISCRIMINATOR = accountDiscriminator("Pool");
const DCA_POSITION_DISCRIMINATOR = accountDiscriminator("DcaPosition");
const WINDOW_DISCRIMINATOR = accountDiscriminator("Window");
const INTENT_DISCRIMINATOR = accountDiscriminator("Intent");

function accountDiscriminator(name: string): Buffer {
  const hash = sha256(new TextEncoder().encode(`account:${name}`));
  return Buffer.from(hash.slice(0, 8));
}

function checkDiscriminator(data: Buffer, expected: Buffer, accountName: string): void {
  if (data.length < 8 || !expected.equals(data.subarray(0, 8))) {
    throw new Error(`Invalid ${accountName} discriminator`);
  }
}

function readPubkey(buf: Buffer, offset: number): PublicKey {
  return new PublicKey(buf.subarray(offset, offset + 32));
}

export function decodePool(data: Buffer): Pool {
  checkDiscriminator(data, POOL_DISCRIMINATOR, "Pool");
  let o = 8;
  const authority = readPubkey(data, o);                      o += 32;
  const inputMint = readPubkey(data, o);                      o += 32;
  const targetMint = readPubkey(data, o);                     o += 32;
  const windowDurationSeconds = data.readBigInt64LE(o);       o += 8;
  const minPoolSizeUsdc = data.readBigUInt64LE(o);            o += 8;
  const feeBps = data.readUInt16LE(o);                        o += 2;
  const totalVolumeProcessed = data.readBigUInt64LE(o);       o += 8;
  const totalSavingsBpsEstimated = data.readBigUInt64LE(o);   o += 8;
  const activeWindow = readPubkey(data, o);                   o += 32;
  const windowCounter = data.readBigUInt64LE(o);              o += 8;
  const bump = data.readUInt8(o);
  return {
    authority,
    inputMint,
    targetMint,
    windowDurationSeconds,
    minPoolSizeUsdc,
    feeBps,
    totalVolumeProcessed,
    totalSavingsBpsEstimated,
    activeWindow,
    windowCounter,
    bump,
  };
}

export function decodeDcaPosition(data: Buffer): DcaPosition {
  checkDiscriminator(data, DCA_POSITION_DISCRIMINATOR, "DcaPosition");
  let o = 8;
  const owner = readPubkey(data, o);                          o += 32;
  const pool = readPubkey(data, o);                           o += 32;
  const amountPerWindow = data.readBigUInt64LE(o);            o += 8;
  const maxSlippageBps = data.readUInt16LE(o);                o += 2;
  const totalDeposited = data.readBigUInt64LE(o);             o += 8;
  const totalAcquired = data.readBigUInt64LE(o);              o += 8;
  const active = data.readUInt8(o) !== 0;                     o += 1;
  const createdTs = data.readBigInt64LE(o);                   o += 8;
  const lastWindow = data.readBigUInt64LE(o);                 o += 8;
  const bump = data.readUInt8(o);
  return {
    owner,
    pool,
    amountPerWindow,
    maxSlippageBps,
    totalDeposited,
    totalAcquired,
    active,
    createdTs,
    lastWindow,
    bump,
  };
}

export function decodeWindow(data: Buffer): Window {
  checkDiscriminator(data, WINDOW_DISCRIMINATOR, "Window");
  let o = 8;
  const pool = readPubkey(data, o);                           o += 32;
  const windowNumber = data.readBigUInt64LE(o);               o += 8;
  const startTs = data.readBigInt64LE(o);                     o += 8;
  const endTs = data.readBigInt64LE(o);                       o += 8;
  const status = data.readUInt8(o) as 0 | 1 | 2 | 3;          o += 1;
  const intentCount = data.readUInt32LE(o);                   o += 4;
  const totalCommittedUsdc = data.readBigUInt64LE(o);         o += 8;
  const aggregateResultHash = new Uint8Array(data.subarray(o, o + 32)); o += 32;
  const tokensAcquired = data.readBigUInt64LE(o);             o += 8;
  const effectiveSlippageBps = data.readUInt16LE(o);          o += 2;
  const bump = data.readUInt8(o);
  return {
    pool,
    windowNumber,
    startTs,
    endTs,
    status,
    intentCount,
    totalCommittedUsdc,
    aggregateResultHash,
    tokensAcquired,
    effectiveSlippageBps,
    bump,
  };
}

export function decodeIntent(data: Buffer): Intent {
  checkDiscriminator(data, INTENT_DISCRIMINATOR, "Intent");
  let o = 8;
  const owner = readPubkey(data, o);                          o += 32;
  const window = readPubkey(data, o);                         o += 32;
  const encryptedIntentHash = new Uint8Array(data.subarray(o, o + 32)); o += 32;
  const amount = data.readBigUInt64LE(o);                     o += 8;
  const allocatedAmount = data.readBigUInt64LE(o);            o += 8;
  const claimed = data.readUInt8(o) !== 0;                    o += 1;
  const bump = data.readUInt8(o);
  return {
    owner,
    window,
    encryptedIntentHash,
    amount,
    allocatedAmount,
    claimed,
    bump,
  };
}
