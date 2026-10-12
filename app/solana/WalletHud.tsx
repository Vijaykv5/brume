"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  AVATAR_COLOR_OPTIONS,
  getAvatarColor,
  type PlayerProfile,
} from "@/multiplayer/avatar-profile";
import type { WalletVerificationState } from "../world/useMultiplayer";
import { formatLamports } from "./format";
import {
  getExplorerUrl,
  shortenWalletAddress,
  SOLANA_NETWORK_LABEL,
} from "./config";
import { useSolBalance } from "./useSolBalance";

export function WalletHud({
  profile,
  verificationState,
  onDisconnect,
}: {
  profile: PlayerProfile;
  verificationState: WalletVerificationState;
  onDisconnect: () => Promise<void>;
}) {
  const { publicKey } = useWallet();
  const { balanceLamports, loading, error, refresh } = useSolBalance();
  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState("");
  if (!publicKey) return null;

  const address = publicKey.toBase58();
  const balance = formatLamports(balanceLamports);
  const outfitColor = getAvatarColor(
    AVATAR_COLOR_OPTIONS,
    profile.avatar.outfitColor,
  );

  return (
    <aside className="wallet-hud" aria-label="Your Solana profile">
      <div className="wallet-hud-profile">
        <span
          className="wallet-hud-avatar"
          style={{ backgroundColor: outfitColor }}
          aria-hidden="true"
        >
          {profile.username.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{profile.username}</strong>
          <button
            type="button"
            title={address}
            onClick={() => {
              void navigator.clipboard.writeText(address);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1_500);
            }}
          >
            {copied ? "Copied" : shortenWalletAddress(address)}
          </button>
        </div>
        <span
          className={`wallet-hud-verification is-${verificationState}`}
          title={`Wallet connection: ${verificationState}`}
        >
          {verificationState === "verified" ? "Connected" : "Connecting"}
        </span>
      </div>
      <div className="wallet-hud-balance">
        <span>Balance · {SOLANA_NETWORK_LABEL}</span>
        {loading ? (
          <span className="wallet-balance-skeleton" aria-label="Loading SOL balance" />
        ) : error ? (
          <button type="button" onClick={() => void refresh()}>Retry balance</button>
        ) : (
          <strong aria-label={balance.ariaLabel} title={balance.raw}>
            {balance.display} <small>SOL</small>
          </strong>
        )}
      </div>
      <div className="wallet-hud-actions">
        <a href={getExplorerUrl("address", address)} target="_blank" rel="noreferrer">
          Explorer ↗
        </a>
        <button
          type="button"
          className="wallet-hud-disconnect"
          disabled={disconnecting}
          onClick={async () => {
            setDisconnecting(true);
            setDisconnectError("");
            try {
              await onDisconnect();
            } catch {
              setDisconnectError("Could not disconnect. Please try again.");
            } finally {
              setDisconnecting(false);
            }
          }}
        >
          {disconnecting ? "Disconnecting…" : "Disconnect wallet"}
        </button>
      </div>
      {disconnectError && <p className="wallet-hud-error" role="alert">{disconnectError}</p>}
    </aside>
  );
}
