"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NetworkEncounter, RpsChoice } from "@/multiplayer/protocol";
import { MAGICBLOCK_ER_RPC } from "../solana/magicblockDeployment";
import type { MagicBlockTransactionState } from "../solana/useMagicBlockWorldSession";

const CHOICES: Array<{ value: RpsChoice; symbol: string; label: string }> = [
  { value: "rock", symbol: "●", label: "Rock" },
  { value: "paper", symbol: "▰", label: "Paper" },
  { value: "scissors", symbol: "✦", label: "Scissors" },
];

function choiceLabel(choice?: RpsChoice) {
  return CHOICES.find((item) => item.value === choice)?.label ?? "—";
}

function resultCopy(encounter: NetworkEncounter, localPlayerId: string) {
  if (encounter.kind === "high_five") {
    return { eyebrow: "Encounter complete", title: "High five landed", body: "A shared social moment, settled through MagicBlock." };
  }
  if (encounter.result === "draw") {
    return { eyebrow: "Match complete", title: "Perfect draw", body: "Same instinct. Run it back when you are ready." };
  }
  const won = encounter.winnerPlayerId === localPlayerId;
  return won
    ? { eyebrow: "Match complete", title: "You won", body: "The result is being anchored to the BRUME World session." }
    : { eyebrow: "Match complete", title: "Good game", body: "Your opponent took this round." };
}

export function EncounterPanel({
  encounter,
  localPlayerId,
  transactionState,
  error,
  onRespond,
  onChoose,
  onRetrySettlement,
  onClose,
}: {
  encounter: NetworkEncounter | null;
  localPlayerId: string | null;
  transactionState: MagicBlockTransactionState;
  error: string;
  onRespond: (accepted: boolean) => void;
  onChoose: (choice: RpsChoice) => void;
  onRetrySettlement: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [lockedChoice, setLockedChoice] = useState<RpsChoice | null>(null);

  const isInitiator = encounter?.initiator.playerId === localPlayerId;
  const partner = useMemo(() => {
    if (!encounter) return null;
    return isInitiator ? encounter.recipient : encounter.initiator;
  }, [encounter, isInitiator]);

  useEffect(() => {
    if (!encounter) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const terminal = encounter.status === "resolved" || encounter.status === "declined" || encounter.status === "cancelled";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (encounter.status === "invited" && !isInitiator) onRespond(false);
        else if (terminal) onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const controls = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    primaryRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [encounter, isInitiator, onClose, onRespond]);

  if (!encounter || !partner || !localPlayerId) return null;

  const incomingInvite = encounter.status === "invited" && !isInitiator;
  const outgoingInvite = encounter.status === "invited" && isInitiator;
  const terminal = encounter.status === "resolved" || encounter.status === "declined" || encounter.status === "cancelled";
  const settlementPending = transactionState === "sending" || transactionState === "confirming";
  const settlementFailed = transactionState === "failed";
  const copy = encounter.status === "resolved" ? resultCopy(encounter, localPlayerId) : null;
  const explorerUrl = encounter.settlementSignature
    ? `https://explorer.solana.com/tx/${encounter.settlementSignature}?cluster=custom&customUrl=${encodeURIComponent(MAGICBLOCK_ER_RPC)}`
    : null;

  return (
    <section
      ref={panelRef}
      className={`encounter-panel is-${encounter.status}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="encounter-title"
      aria-busy={settlementPending}
    >
      <div className="encounter-signal" aria-hidden="true">
        <span>{encounter.kind === "rps" ? "RPS" : "HF"}</span>
        <i />
      </div>

      {incomingInvite && (
        <>
          <p className="encounter-eyebrow">Incoming encounter</p>
          <h2 id="encounter-title">{partner.username} is nearby</h2>
          <p>{encounter.kind === "rps" ? "A quick rock–paper–scissors match, resolved live and settled on MagicBlock." : "They want to share an on-chain high five."}</p>
          <div className="encounter-actions">
            <button ref={primaryRef} type="button" className="is-primary" onClick={() => onRespond(true)}>Accept</button>
            <button type="button" onClick={() => onRespond(false)}>Not now</button>
          </div>
        </>
      )}

      {outgoingInvite && (
        <>
          <p className="encounter-eyebrow">Invite sent</p>
          <h2 id="encounter-title">Waiting for {partner.username}</h2>
          <p>Stay close. The encounter begins as soon as they accept.</p>
          <div className="encounter-wait" role="status"><i aria-hidden="true" /><span>Live invite</span></div>
        </>
      )}

      {encounter.status === "choosing" && (
        <>
          <p className="encounter-eyebrow">MagicBlock encounter</p>
          <h2 id="encounter-title">Choose your move</h2>
          <p>Your move stays hidden until {partner.username} locks theirs.</p>
          <div className="encounter-choices" aria-label="Choose rock, paper, or scissors">
            {CHOICES.map((choice, index) => (
              <button
                ref={index === 0 ? primaryRef : undefined}
                key={choice.value}
                type="button"
                disabled={lockedChoice !== null}
                aria-pressed={lockedChoice === choice.value}
                onClick={() => {
                  setLockedChoice(choice.value);
                  onChoose(choice.value);
                }}
              >
                <span aria-hidden="true">{choice.symbol}</span>
                <b>{choice.label}</b>
              </button>
            ))}
          </div>
          {lockedChoice && <div className="encounter-wait" role="status"><i aria-hidden="true" /><span>{choiceLabel(lockedChoice)} locked · waiting for {partner.username}</span></div>}
        </>
      )}

      {encounter.status === "resolved" && copy && (
        <>
          <p className="encounter-eyebrow">{copy.eyebrow}</p>
          <h2 id="encounter-title">{copy.title}</h2>
          <p>{copy.body}</p>
          {encounter.kind === "rps" && (
            <div className="encounter-score">
              <span><small>You</small><b>{choiceLabel(isInitiator ? encounter.initiatorChoice : encounter.recipientChoice)}</b></span>
              <i>vs</i>
              <span><small>{partner.username}</small><b>{choiceLabel(isInitiator ? encounter.recipientChoice : encounter.initiatorChoice)}</b></span>
            </div>
          )}
          <div className={`encounter-settlement ${settlementFailed ? "is-failed" : ""}`} role="status">
            <i aria-hidden="true" />
            <span>
              <b>{encounter.settlementSignature ? "Settled on MagicBlock" : settlementFailed ? "Settlement needs a retry" : settlementPending ? "Settling on the ER…" : isInitiator ? "Preparing ER settlement…" : "Waiting for settlement proof…"}</b>
              <small>Wallet-authenticated encounter receipt</small>
            </span>
          </div>
          {(error || settlementFailed) && <p className="encounter-error">{error || "The ER transaction did not confirm."}</p>}
          <div className="encounter-actions">
            {explorerUrl && <a href={explorerUrl} target="_blank" rel="noreferrer">View ER transaction ↗</a>}
            {settlementFailed && isInitiator && <button type="button" onClick={onRetrySettlement}>Retry settlement</button>}
            <button ref={primaryRef} type="button" onClick={onClose}>Done</button>
          </div>
        </>
      )}

      {(encounter.status === "declined" || encounter.status === "cancelled") && (
        <>
          <p className="encounter-eyebrow">Encounter ended</p>
          <h2 id="encounter-title">{encounter.status === "declined" ? "Maybe next time" : "Connection lost"}</h2>
          <p>{encounter.status === "declined" ? `${partner.username} declined the invite.` : "One explorer left before the encounter finished."}</p>
          <div className="encounter-actions"><button ref={primaryRef} type="button" onClick={onClose}>Close</button></div>
        </>
      )}

      {!terminal && <small className="encounter-footnote">Session keys keep gameplay gasless after one devnet approval.</small>}
    </section>
  );
}
