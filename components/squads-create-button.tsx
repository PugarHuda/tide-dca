"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, ComputeBudgetProgram } from "@solana/web3.js";

import { buildCreateMultisigIx } from "@/lib/squads";
import { useToast } from "@/components/toast";

/**
 * Admin "Create Squads multisig" — drops a real Squads V4
 * multisig_create_v2 instruction at the connected wallet. The created
 * multisig has the connected wallet as sole member with threshold 1.
 *
 * Why solo: the demo flow doesn't require multiple signers, but the
 * resulting account is a real Squads multisig — once created, the
 * authority of the Tide pool can be transferred to it via spl-token
 * authorize, completing the "single-key → multisig" migration claim.
 *
 * Devnet caveat: Squads V4 program is deployed on mainnet only. On
 * devnet the simulation returns AccountNotFound and the button surfaces
 * an honest "deploy on mainnet" message rather than silently succeeding.
 */
export function SquadsCreateButton() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      toast.error("Connect wallet first");
      return;
    }
    setBusy(true);
    try {
      const { instruction, multisigPda, createKey } = buildCreateMultisigIx({
        creator: wallet.publicKey,
        additionalMembers: [],
        threshold: 1,
      });

      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }))
        .add(instruction);

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;
      tx.partialSign(createKey);

      // Pre-flight to surface devnet "Squads not initialized on this cluster" cleanly.
      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        const msg =
          typeof sim.value.err === "string"
            ? sim.value.err
            : JSON.stringify(sim.value.err);
        const logs = (sim.value.logs ?? []).join(" ");
        // Squads V4 IS deployed on devnet, but its program_config PDA
        // isn't initialized there — Squads-internal setup is mainnet-only.
        // We catch both "program missing" (AccountNotFound) and "program
        // present but not initialized" (Custom 3012 / AccountNotInitialized).
        const isClusterUnsupported =
          /AccountNotFound|ProgramAccountNotFound|InvalidProgramId|AccountNotInitialized|"Custom":\s*3012/i.test(
            msg + " " + logs,
          );
        toast.error(
          isClusterUnsupported
            ? "Squads V4 isn't bootstrapped on this cluster. Tx is correctly built — fire from a mainnet wallet to actually create."
            : `Squads create simulation failed: ${msg}`,
        );
        return;
      }

      const sig = await wallet.sendTransaction(tx, connection, {
        signers: [createKey],
      });
      await connection.confirmTransaction(sig, "confirmed");
      toast.success(`Multisig created · ${multisigPda.toBase58().slice(0, 8)}…`, {
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
      title="Create a Squads V4 multisig with this wallet as sole member"
    >
      {busy && <span className="spinner spinner--sm" />}
      {busy ? "Submitting…" : "Create Squads multisig"}
    </button>
  );
}
