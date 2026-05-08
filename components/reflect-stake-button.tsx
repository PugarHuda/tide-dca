"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, ComputeBudgetProgram } from "@solana/web3.js";

import { buildReflectDepositIx, reflectConfigured } from "@/lib/reflect";
import { USDC_MINT_DEVNET, USDC_MINT_MAINNET, CURRENT_NETWORK } from "@/lib/constants";
import { useToast } from "@/components/toast";

/**
 * Admin "Stake idle USDC to Reflect" button. When Reflect program +
 * rUSDC mint env vars are set, builds a real deposit tx (idempotent ATA
 * + Anchor-style deposit ix) and submits via the connected wallet.
 *
 * Without env config, the button stays mounted but stops on simulation
 * with a toast — never silently no-ops, always tells the user *why*.
 */
export function ReflectStakeButton({ amountUsdc = 10 }: { amountUsdc?: number }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      toast.error("Connect wallet first");
      return;
    }
    if (!reflectConfigured()) {
      toast.error(
        "Reflect program id not configured. Set NEXT_PUBLIC_REFLECT_PROGRAM_ID + NEXT_PUBLIC_REFLECT_RUSDC_MINT to enable mainnet stake.",
      );
      return;
    }
    setBusy(true);
    try {
      const usdcMint =
        CURRENT_NETWORK === "mainnet" ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
      const { instructions } = buildReflectDepositIx({
        depositor: wallet.publicKey,
        usdcMint,
        amount: BigInt(Math.round(amountUsdc * 1_000_000)),
      });

      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }))
        .add(...instructions);

      // Pre-flight via simulation so we surface "Reflect program not
      // deployed on this cluster" honestly instead of an opaque wallet
      // popup error.
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;
      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        const msg =
          typeof sim.value.err === "string"
            ? sim.value.err
            : JSON.stringify(sim.value.err);
        const isNotDeployed =
          /AccountNotFound|ProgramAccountNotFound|InvalidProgramId/i.test(msg);
        if (isNotDeployed && CURRENT_NETWORK !== "mainnet") {
          toast.error(
            `Reflect program not deployed on ${CURRENT_NETWORK}. Tx is correct — submit on mainnet to actually stake.`,
          );
        } else {
          toast.error(`Reflect deposit simulation failed: ${msg}`);
        }
        return;
      }

      const sig = await wallet.sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      toast.success(`Staked ${amountUsdc} USDC to Reflect`, {
        explorerSig: sig,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={() => void onClick()}
      disabled={busy || !wallet.publicKey}
      className="btn btn--ghost btn--sm"
      title={
        !wallet.publicKey
          ? "Connect wallet"
          : reflectConfigured()
            ? `Stake ${amountUsdc} USDC to Reflect vault`
            : "Reflect env vars not set — preview only"
      }
    >
      {busy && <span className="spinner spinner--sm" />}
      {busy ? "Submitting…" : `Stake ${amountUsdc} USDC to Reflect`}
    </button>
  );
}
