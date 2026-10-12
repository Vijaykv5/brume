"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import nacl from "tweetnacl";
import {
  createDefaultPlayerProfile,
  parsePlayerProfile,
  type PlayerProfile,
} from "@/multiplayer/avatar-profile";
import { SceneCanvas } from "../SceneCanvas";
import { SolanaProvider } from "../solana/SolanaProvider";
import {
  readStoredPlayerProfile,
  storePlayerProfile,
} from "../world/profile-storage";
import { CharacterOnboarding } from "./CharacterOnboarding";

const ARENA_ACCESS_KEY = "brume-world:arena-access:v1";
const SIGN_IN_PREFIX = "BRUME World sign-in";

type ArenaAccessProof = {
  version: 1;
  walletAddress: string;
  message: string;
  signature: string;
  verifiedAt: number;
};

function subscribeToBrowserReady() {
  return () => undefined;
}

function useBrowserReady() {
  return useSyncExternalStore(
    subscribeToBrowserReady,
    () => true,
    () => false,
  );
}

function bytesToBase64(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readAccessProof() {
  try {
    const value = window.localStorage.getItem(ARENA_ACCESS_KEY);
    if (!value) return null;
    const proof = JSON.parse(value) as Partial<ArenaAccessProof>;
    if (
      proof.version !== 1 ||
      typeof proof.walletAddress !== "string" ||
      typeof proof.message !== "string" ||
      typeof proof.signature !== "string" ||
      typeof proof.verifiedAt !== "number"
    ) {
      return null;
    }
    return proof as ArenaAccessProof;
  } catch {
    return null;
  }
}

function storeAccessProof(proof: ArenaAccessProof) {
  try {
    window.localStorage.setItem(ARENA_ACCESS_KEY, JSON.stringify(proof));
  } catch {
    // Access persists for this render even if private browsing blocks storage.
  }
}

function clearAccessProof() {
  try {
    window.localStorage.removeItem(ARENA_ACCESS_KEY);
  } catch {
    // Wallet state still closes the arena when storage is unavailable.
  }
}

function isStoredProofValid(
  proof: ArenaAccessProof | null,
  walletAddress: string,
  publicKeyBytes: Uint8Array,
) {
  if (
    !proof ||
    proof.walletAddress !== walletAddress ||
    !proof.message.startsWith(`${SIGN_IN_PREFIX}\n`) ||
    !proof.message.includes(`Wallet: ${walletAddress}`)
  ) {
    return false;
  }

  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(proof.message),
      base64ToBytes(proof.signature),
      publicKeyBytes,
    );
  } catch {
    return false;
  }
}

function WalletGateContent() {
  const {
    connected,
    connecting,
    connect,
    disconnect,
    publicKey,
    signMessage,
    wallet,
  } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const browserReady = useBrowserReady();
  const storedProfile = useMemo(
    () => (browserReady ? readStoredPlayerProfile() : null),
    [browserReady],
  );
  const [draftProfile, setDraftProfile] = useState<PlayerProfile | null>(null);
  const profile = draftProfile ?? storedProfile ?? createDefaultPlayerProfile();
  const [sessionAccessWallet, setSessionAccessWallet] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const walletAddress = connected && publicKey ? publicKey.toBase58() : null;
  const accessGranted = useMemo(() => {
    if (!browserReady || !walletAddress || !publicKey) return false;
    return (
      sessionAccessWallet === walletAddress ||
      isStoredProofValid(readAccessProof(), walletAddress, publicKey.toBytes())
    );
  }, [browserReady, publicKey, sessionAccessWallet, walletAddress]);

  const signAndEnter = useCallback(
    async (nextProfile: PlayerProfile) => {
      if (!publicKey || !connected) return;
      if (!signMessage) {
        setError("This wallet cannot sign messages. Choose Phantom, Solflare, or another compatible wallet.");
        return;
      }

      setSigning(true);
      setError("");
      setNotice("Approve the free identity message in your wallet.");
      const walletAddress = publicKey.toBase58();
      const message = [
        SIGN_IN_PREFIX,
        "",
        `Wallet: ${walletAddress}`,
        `Explorer: ${nextProfile.username}`,
        "Purpose: Enter the BRUME World arena",
        `Nonce: ${crypto.randomUUID()}`,
        `Issued at: ${new Date().toISOString()}`,
        "",
        "This request is free and does not submit a transaction.",
      ].join("\n");
      const messageBytes = new TextEncoder().encode(message);

      try {
        const signature = await signMessage(messageBytes);
        if (!nacl.sign.detached.verify(messageBytes, signature, publicKey.toBytes())) {
          throw new Error("The wallet returned a signature that could not be verified.");
        }

        setSigning(false);
        setSavingProfile(true);
        setNotice("Saving your explorer to BRUME World…");
        const encodedSignature = bytesToBase64(signature);
        const response = await fetch("/api/player-profile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            message,
            signature: encodedSignature,
            profile: nextProfile,
          }),
        });
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(result?.error || "Your character could not be saved. Please try again.");
        }

        storePlayerProfile(nextProfile);
        storeAccessProof({
          version: 1,
          walletAddress,
          message,
          signature: encodedSignature,
          verifiedAt: Date.now(),
        });
        setDraftProfile(nextProfile);
        setNotice("");
        setSessionAccessWallet(walletAddress);
      } catch (cause) {
        const messageText = cause instanceof Error ? cause.message : "";
        const rejected = /reject|declin|cancel/i.test(messageText);
        setNotice(rejected ? "Signature canceled. Your character is still saved here." : "");
        setError(
          rejected
            ? ""
            : messageText || "The message could not be signed. Check your wallet and try again.",
        );
      } finally {
        setSigning(false);
        setSavingProfile(false);
      }
    },
    [connected, publicKey, signMessage],
  );

  const handleContinue = useCallback(
    async (nextProfile: PlayerProfile) => {
      const validProfile = parsePlayerProfile(nextProfile);
      if (!validProfile) return;

      setDraftProfile(validProfile);
      storePlayerProfile(validProfile);
      setError("");
      setNotice("");

      if (!wallet) {
        setWalletModalVisible(true);
        return;
      }

      if (!connected) {
        try {
          await connect();
          setNotice("Wallet connected. Click once more to sign and enter.");
        } catch (cause) {
          const messageText = cause instanceof Error ? cause.message : "";
          if (!/reject|declin|cancel/i.test(messageText)) {
            setError(messageText || "The wallet could not connect. Try another wallet.");
          }
        }
        return;
      }

      await signAndEnter(validProfile);
    },
    [connect, connected, setWalletModalVisible, signAndEnter, wallet],
  );

  const handleDisconnect = useCallback(async () => {
    clearAccessProof();
    setSessionAccessWallet(null);
    setError("");
    setNotice("");
    await disconnect();
  }, [disconnect]);

  if (!browserReady) {
    return (
      <main className="character-onboarding character-onboarding-loading" aria-label="Preparing your explorer">
        <div className="character-onboarding-loading-mark" aria-hidden="true">B</div>
        <p>Preparing your explorer…</p>
      </main>
    );
  }

  if (connected && publicKey && accessGranted) {
    return (
      <main className="scene-shell" aria-label="BRUME World interactive city">
        <SceneCanvas
          key={publicKey.toBase58()}
          walletAddress={publicKey.toBase58()}
        />
      </main>
    );
  }

  return (
    <CharacterOnboarding
      profile={profile}
      walletAddress={walletAddress}
      connecting={connecting}
      signing={signing}
      savingProfile={savingProfile}
      notice={notice}
      error={error}
      onProfileChange={setDraftProfile}
      onContinue={(nextProfile) => void handleContinue(nextProfile)}
      onDisconnect={() => void handleDisconnect()}
    />
  );
}

export function ArenaWalletGate() {
  return (
    <SolanaProvider>
      <WalletGateContent />
    </SolanaProvider>
  );
}
