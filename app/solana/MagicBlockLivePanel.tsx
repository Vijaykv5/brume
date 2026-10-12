"use client";

import { useState } from "react";
import { getExplorerUrl, shortenWalletAddress } from "./config";
import { MAGICBLOCK_DEPLOYMENT, MAGICBLOCK_ER_RPC, MAGICBLOCK_SESSION_PROGRAM } from "./magicblockDeployment";
import type {
  MagicBlockLiveState,
  MagicBlockTransactionState,
} from "./useMagicBlockWorldSession";

function ProofLink({ label, value, path }: { label: string; value: string; path: "address" | "tx" }) {
  return (
    <a href={getExplorerUrl(path, value)} target="_blank" rel="noreferrer">
      <span>{label}</span>
      <code>{shortenWalletAddress(value, 5)}</code>
    </a>
  );
}

function ErTransactionLink({ signature }: { signature: string }) {
  const href = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(MAGICBLOCK_ER_RPC)}`;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      <span>Latest ER action</span>
      <code>{shortenWalletAddress(signature, 5)}</code>
    </a>
  );
}

export function MagicBlockLivePanel({
  liveState,
  transactionState,
  interactionCount,
  lastSignature,
  authorizationSignature,
  sessionSignerAddress,
  sessionTokenAddress,
  sessionExpiresAt,
  error,
  onRetry,
}: {
  liveState: MagicBlockLiveState;
  transactionState: MagicBlockTransactionState;
  interactionCount: number | null;
  lastSignature: string | null;
  authorizationSignature: string | null;
  sessionSignerAddress: string | null;
  sessionTokenAddress: string | null;
  sessionExpiresAt: number | null;
  error: string | null;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusLabel =
    liveState === "checking" ? "Checking ER" : liveState === "live" ? "ER live" : "Needs attention";

  return (
    <aside className={`magicblock-live-panel is-${liveState}`} aria-label="MagicBlock deployment status">
      <button
        type="button"
        className="magicblock-live-summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="magicblock-live-mark" aria-hidden="true">M</span>
        <span>
          <strong>MagicBlock Live</strong>
          <small><i aria-hidden="true" />{statusLabel} · {interactionCount ?? "—"} interactions</small>
        </span>
        <b aria-hidden="true">{expanded ? "−" : "+"}</b>
      </button>

      {expanded && (
        <div className="magicblock-live-details">
          <p>BRUME social actions execute on an Ephemeral Rollup, then commit to Solana devnet.</p>
          <div className="magicblock-session-flow" aria-label="MagicBlock transaction flow">
            <span className={authorizationSignature ? "is-complete" : "is-current"}>1 <b>Wallet approval</b></span>
            <i aria-hidden="true" />
            <span className={sessionTokenAddress ? "is-complete" : ""}>2 <b>Session key</b></span>
            <i aria-hidden="true" />
            <span className={lastSignature ? "is-complete" : ""}>3 <b>ER action</b></span>
          </div>
          <div className="magicblock-proof-links">
            <ProofLink label="Program" value={MAGICBLOCK_DEPLOYMENT.programId} path="address" />
            <ProofLink label="WorldSession PDA" value={MAGICBLOCK_DEPLOYMENT.worldSessionPda} path="address" />
            <ProofLink label="Session program" value={MAGICBLOCK_SESSION_PROGRAM} path="address" />
            <ProofLink label="Session upgrade" value={MAGICBLOCK_DEPLOYMENT.sessionKeysUpgradeSignature} path="tx" />
            <ProofLink label="Encounter upgrade" value={MAGICBLOCK_DEPLOYMENT.encounterUpgradeSignature} path="tx" />
            <ProofLink label="Encounter authorization" value={MAGICBLOCK_DEPLOYMENT.encounterAuthorizationSignature} path="tx" />
            <ProofLink label="Delegation tx" value={MAGICBLOCK_DEPLOYMENT.delegationSignature} path="tx" />
            <ProofLink label="Latest base commit" value={MAGICBLOCK_DEPLOYMENT.baseCommitSignature} path="tx" />
            {authorizationSignature && <ProofLink label="Wallet authorization" value={authorizationSignature} path="tx" />}
            {sessionTokenAddress && <ProofLink label="Session token" value={sessionTokenAddress} path="address" />}
            <ErTransactionLink signature={lastSignature ?? MAGICBLOCK_DEPLOYMENT.initialEncounterErSignature} />
          </div>
          {transactionState !== "idle" && (
            <div className={`magicblock-tx-status is-${transactionState}`} role="status">
              <span aria-hidden="true" />
              <div>
                <strong>
                  {transactionState === "authorizing" && "Approve once on Solana devnet"}
                  {transactionState === "sending" && "Sending authorized ER action"}
                  {transactionState === "confirming" && "Confirming on the ER"}
                  {transactionState === "confirmed" && "Interaction confirmed"}
                  {transactionState === "failed" && "Interaction failed"}
                </strong>
                {lastSignature && <code title={lastSignature}>ER tx {shortenWalletAddress(lastSignature, 5)}</code>}
              </div>
            </div>
          )}
          {error && <p className="magicblock-live-error">{error}</p>}
          {sessionSignerAddress && (
            <small className="magicblock-live-session" title={sessionSignerAddress}>
              Authorized signer · {shortenWalletAddress(sessionSignerAddress, 5)}
              {sessionExpiresAt ? ` · expires ${new Date(sessionExpiresAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
            </small>
          )}
          {liveState === "offline" && <button type="button" className="magicblock-live-retry" onClick={onRetry}>Check again</button>}
          <small className="magicblock-live-note">Your wallet approves a one-hour, program-scoped session on devnet. The temporary key then signs gasless ER actions; avatar movement stays on WebSocket.</small>
        </div>
      )}
    </aside>
  );
}
