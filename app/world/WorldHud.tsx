"use client";

import { useProgress } from "@react-three/drei";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useRef, useState } from "react";
import type { EncounterKind, NetworkPlayer } from "@/multiplayer/protocol";
import {
  AVATAR_COLOR_OPTIONS,
  getAvatarColor,
} from "@/multiplayer/avatar-profile";
import { shortenWalletAddress } from "../solana/config";
import { formatLamports } from "../solana/format";
import type { WorldInteraction } from "./types";

export function ControlsTutorial() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <aside className="world-controls" aria-labelledby="world-controls-title">
      <div className="world-controls-header">
        <div>
          <p>Welcome to</p>
          <h2 id="world-controls-title">BRUME World</h2>
        </div>
        <button
          type="button"
          aria-label="Dismiss controls tutorial"
          onClick={() => setVisible(false)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <dl className="world-controls-list">
        <div>
          <dt><kbd>WASD</kbd><span>or arrows</span></dt>
          <dd>Move</dd>
        </div>
        <div>
          <dt><kbd>Shift</kbd></dt>
          <dd>Run</dd>
        </div>
        <div>
          <dt><span>Drag</span><span>+ wheel</span></dt>
          <dd>Look and zoom</dd>
        </div>
        <div>
          <dt><kbd>E</kbd></dt>
          <dd>Interact</dd>
        </div>
      </dl>
    </aside>
  );
}

export function InteractionPrompt({
  interaction,
}: {
  interaction: WorldInteraction | null;
}) {
  if (!interaction) return null;

  return (
    <div className="world-interaction-prompt" role="status">
      <kbd>E</kbd>
      <span>Interact with {interaction.title}</span>
    </div>
  );
}

export function PlayerInteractionPrompt({
  player,
}: {
  player: NetworkPlayer | null;
}) {
  if (!player) return null;

  return (
    <div
      className="world-interaction-prompt world-player-interaction-prompt"
      role="status"
      aria-label={`Press E to interact with ${player.username}`}
    >
      <kbd>E</kbd>
      <span>Press E to interact</span>
      <strong>{player.username}</strong>
    </div>
  );
}

export function PlayerInteractionPanel({
  player,
  onClose,
  onSendSol,
  onStartEncounter,
}: {
  player: NetworkPlayer | null;
  onClose: () => void;
  onSendSol: (player: NetworkPlayer) => void;
  onStartEncounter: (player: NetworkPlayer, kind: EncounterKind) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [showingProfile, setShowingProfile] = useState(false);
  const [remoteBalance, setRemoteBalance] = useState<number | null>(null);
  const [remoteBalanceLoading, setRemoteBalanceLoading] = useState(false);
  const { connection } = useConnection();

  useEffect(() => {
    if (!player?.walletAddress || !showingProfile) return;

    let disposed = false;
    connection
      .getBalance(new PublicKey(player.walletAddress), "confirmed")
      .then((balance) => {
        if (!disposed) setRemoteBalance(balance);
      })
      .catch(() => {
        if (!disposed) setRemoteBalance(null);
      })
      .finally(() => {
        if (!disposed) setRemoteBalanceLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [connection, player?.walletAddress, showingProfile]);

  useEffect(() => {
    if (!player) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    closeButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [player]);

  if (!player) return null;

  const movementLabel =
    player.movementState === "running"
      ? "Running nearby"
      : player.movementState === "walking"
        ? "Walking nearby"
        : "Standing nearby";
  const outfitColor = getAvatarColor(
    AVATAR_COLOR_OPTIONS,
    player.avatar.outfitColor,
  );
  const formattedRemoteBalance = formatLamports(remoteBalance);
  return (
    <section
      ref={panelRef}
      className="world-interaction-panel world-player-interaction-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="world-player-interaction-title"
    >
      <div
        className="world-player-profile-mark"
        style={{ backgroundColor: outfitColor }}
        aria-hidden="true"
      >
        <span>{player.username.slice(-4)}</span>
      </div>
      <div className="world-interaction-header">
        <div>
          <p>Nearby explorer</p>
          <h2 id="world-player-interaction-title">{player.username}</h2>
        </div>
        <button
          ref={closeButtonRef}
          className="world-interaction-close"
          type="button"
          aria-label="Close player interaction"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="world-player-status">
        <span aria-hidden="true" />
        {movementLabel}
      </div>

      {showingProfile && (
        <div className="world-player-profile" role="status">
          <span>Wallet</span>
          {player.walletAddress ? (
            <button
              type="button"
              title={player.walletAddress}
              onClick={() => void navigator.clipboard.writeText(player.walletAddress ?? "")}
            >
              {shortenWalletAddress(player.walletAddress)} · Copy
            </button>
          ) : (
            <code>Not connected</code>
          )}
          <span>Balance</span>
          <code
            aria-label={
              remoteBalanceLoading
                ? "Loading SOL balance"
                : formattedRemoteBalance.ariaLabel
            }
          >
            {remoteBalanceLoading
              ? "Loading…"
              : `${formattedRemoteBalance.display} SOL`}
          </code>
          <span>Session</span>
          <code title={player.id}>{player.id.slice(0, 8)}</code>
          <p>
            {player.walletAddress
              ? "This explorer connected this wallet to the current BRUME session."
              : "This explorer has not connected a wallet in this session."}
          </p>
        </div>
      )}

      <div className="world-player-actions" aria-label="Player actions">
        <button
          type="button"
          className="world-player-action is-available is-magicblock"
          disabled={!player.walletAddress}
          onClick={() => onStartEncounter(player, "rps")}
        >
          <span>Play Rock Paper Scissors</span>
          <small>{player.walletAddress ? "Verifiable MagicBlock match" : "Both wallets required"}</small>
        </button>
        <button
          type="button"
          className="world-player-action is-available is-encounter-secondary"
          disabled={!player.walletAddress}
          onClick={() => onStartEncounter(player, "high_five")}
        >
          <span>Send a high five</span>
          <small>Shared encounter receipt</small>
        </button>
        <button
          type="button"
          className="world-player-action is-available"
          aria-pressed={showingProfile}
          onClick={() => {
            setShowingProfile((visible) => !visible);
            if (player.walletAddress) setRemoteBalanceLoading(true);
          }}
        >
          <span>View Player</span>
          <small>{showingProfile ? "Hide profile" : "Open profile"}</small>
        </button>
        <button
          type="button"
          className={player.walletAddress ? "world-player-action is-available" : "world-player-action"}
          disabled={!player.walletAddress}
          onClick={() => onSendSol(player)}
        >
          <span>Send SOL or asset</span>
          <small>{player.walletAddress ? "Direct wallet transfer" : "Wallet required"}</small>
        </button>
      </div>
      <p className="world-interaction-hint">Press Escape to close</p>
    </section>
  );
}

export function InteractionPanel({
  interaction,
  onClose,
  onVisit,
}: {
  interaction: WorldInteraction | null;
  onClose: () => void;
  onVisit: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [failedImageUrl, setFailedImageUrl] = useState("");

  useEffect(() => {
    if (!interaction) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    closeButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [interaction]);

  if (!interaction) return null;

  return (
    <section
      ref={panelRef}
      className="world-interaction-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="world-interaction-title"
    >
      <div className="world-interaction-visual">
        {interaction.imageUrl && interaction.imageUrl !== failedImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={interaction.imageUrl}
            alt={`${interaction.title} project artwork`}
            width="560"
            height="256"
            onError={() => setFailedImageUrl(interaction.imageUrl ?? "")}
          />
        ) : (
          <span aria-hidden="true">{interaction.title.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="world-interaction-header">
        <div>
          <p>{interaction.kind === "billboard" ? "Billboard" : "Building"}</p>
          <h2 id="world-interaction-title">{interaction.title}</h2>
        </div>
        <button
          ref={closeButtonRef}
          className="world-interaction-close"
          type="button"
          aria-label="Close interaction"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <p className="world-interaction-subtitle">{interaction.subtitle}</p>
      <p className="world-interaction-description">{interaction.description}</p>
      <div className="world-interaction-actions">
        <button type="button" className="world-interaction-secondary" onClick={onClose}>
          Keep exploring
        </button>
        {interaction.websiteUrl && (
          <a
            className="world-interaction-primary"
            href={interaction.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onVisit}
          >
            Visit website
          </a>
        )}
      </div>
      <p className="world-interaction-hint">Press Escape to close</p>
    </section>
  );
}

export function WorldLoading({ visible }: { visible: boolean }) {
  const { active } = useProgress();
  if (!visible && !active) return null;

  return (
    <div className="world-loading" role="status" aria-live="polite">
      <span aria-hidden="true" />
      <p>Preparing BRUME World…</p>
    </div>
  );
}
