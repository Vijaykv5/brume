"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import type { NetworkPlayer } from "@/multiplayer/protocol";
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
}: {
  player: NetworkPlayer | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [showingProfile, setShowingProfile] = useState(false);

  useEffect(() => {
    if (!player) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"),
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

  return (
    <section
      ref={panelRef}
      className="world-interaction-panel world-player-interaction-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="world-player-interaction-title"
    >
      <div className="world-player-profile-mark" aria-hidden="true">
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
          <span>Session</span>
          <code title={player.id}>{player.id.slice(0, 8)}</code>
          <p>This explorer is connected to the same BRUME world session.</p>
        </div>
      )}

      <div className="world-player-actions" aria-label="Player actions">
        <button
          type="button"
          className="world-player-action is-available"
          aria-pressed={showingProfile}
          onClick={() => setShowingProfile((visible) => !visible)}
        >
          <span>View Player</span>
          <small>{showingProfile ? "Hide profile" : "Open profile"}</small>
        </button>
        <button type="button" className="world-player-action" disabled>
          <span>Request Chat</span>
          <small>Coming Soon</small>
        </button>
        <button type="button" className="world-player-action" disabled>
          <span>Send SOL</span>
          <small>Coming Soon</small>
        </button>
        <button type="button" className="world-player-action" disabled>
          <span>Request Gas</span>
          <small>Coming Soon</small>
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
