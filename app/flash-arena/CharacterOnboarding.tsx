"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import {
  AVATAR_ACCENT_OPTIONS,
  AVATAR_COLOR_OPTIONS,
  AVATAR_HAT_OPTIONS,
  AVATAR_PANTS_OPTIONS,
  AVATAR_SKIN_OPTIONS,
  DEFAULT_AVATAR_STYLE,
  isValidUsername,
  normalizeUsername,
  type AvatarStyle,
  type PlayerProfile,
} from "@/multiplayer/avatar-profile";
import { SOLANA_NETWORK_LABEL } from "../solana/config";
import { PlayerAvatar } from "../world/PlayerAvatar";
import type { PlayerMotionState } from "../world/types";

type CharacterOnboardingProps = {
  profile: PlayerProfile;
  walletAddress: string | null;
  connecting: boolean;
  signing: boolean;
  savingProfile: boolean;
  notice: string;
  error: string;
  onProfileChange: (profile: PlayerProfile) => void;
  onContinue: (profile: PlayerProfile) => void;
  onDisconnect: () => void;
};

function PreviewCharacter({ profile }: { profile: PlayerProfile }) {
  const groupRef = useRef<THREE.Group>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const motionRef = useRef<PlayerMotionState>({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    heading: 0,
    moving: false,
    running: false,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (reducedMotion) {
      groupRef.current.rotation.y = THREE.MathUtils.damp(
        groupRef.current.rotation.y,
        0,
        4,
        delta,
      );
      return;
    }
    groupRef.current.rotation.y =
      (groupRef.current.rotation.y + delta * 0.48) % (Math.PI * 2);
  });

  return (
    <group ref={groupRef} position={[0, -1.2, 0]} rotation={[0, -0.08, 0]}>
      <PlayerAvatar
        motionRef={motionRef}
        username={profile.username || "BRUME Explorer"}
        avatar={profile.avatar}
        showUsername={false}
      />
    </group>
  );
}

function CharacterPreview({ profile }: { profile: PlayerProfile }) {
  return (
    <div className="character-onboarding-preview-canvas" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.92, 6.7], fov: 31 }}
        dpr={[1, 1.5]}
        shadows
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.9} />
        <directionalLight
          castShadow
          intensity={2.55}
          position={[3, 6, 4]}
          shadow-mapSize={[512, 512]}
        />
        <pointLight color="#79f4bd" intensity={12} position={[-3, 2, 2]} />
        <pointLight color="#8bd8ff" intensity={9} position={[3, 1, -2]} />
        <mesh receiveShadow position={[0, -1.17, 0]}>
          <cylinderGeometry args={[1.12, 1.28, 0.14, 48]} />
          <meshStandardMaterial color="#103c33" roughness={0.72} metalness={0.08} />
        </mesh>
        <PreviewCharacter profile={profile} />
        <ContactShadows
          position={[0, -1.17, 0]}
          opacity={0.34}
          scale={5}
          blur={2.5}
          far={4}
          color="#071b18"
        />
      </Canvas>
    </div>
  );
}

function OnboardingBrandMark() {
  return (
    <svg viewBox="0 0 42 42" aria-hidden="true">
      <path d="M11.4 24.7c-4.1 0-7.4-3-7.4-6.8 0-3.5 2.8-6.4 6.5-6.8C12 6.9 16.1 4 20.9 4c6 0 10.9 4.5 11.3 10.2 3.4.8 5.8 3.7 5.8 7 0 4-3.5 7.3-7.8 7.3H11.4Z" />
      <path d="M13.5 33.6h15M17.4 38h7.2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

function ColorChoices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string; color: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="character-choice-group">
      <legend>{label}</legend>
      <div className="character-swatch-row">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-label={`${label}: ${option.label}`}
            aria-pressed={value === option.id}
            title={option.label}
            onClick={() => onChange(option.id)}
          >
            <span style={{ backgroundColor: option.color }} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function WalletGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h10A2.5 2.5 0 0 1 19 6.5V8h-5.5A2.5 2.5 0 0 0 11 10.5v3a2.5 2.5 0 0 0 2.5 2.5H19v1.5a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 4 17.5v-11Z" />
      <path d="M13 10.5c0-.55.45-1 1-1h6v5h-6a1 1 0 0 1-1-1v-3Z" />
    </svg>
  );
}

export function CharacterOnboarding({
  profile,
  walletAddress,
  connecting,
  signing,
  savingProfile,
  notice,
  error,
  onProfileChange,
  onContinue,
  onDisconnect,
}: CharacterOnboardingProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        router.push("/");
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], input:not([disabled]), button:not([disabled])',
        ),
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

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [router]);

  const updateAvatar = <TKey extends keyof AvatarStyle>(
    key: TKey,
    value: AvatarStyle[TKey],
  ) => {
    onProfileChange({
      ...profile,
      avatar: { ...profile.avatar, [key]: value },
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = normalizeUsername(profile.username);
    if (!isValidUsername(username)) {
      setNameError("Use 2–20 letters, numbers, spaces, dots, dashes, or underscores.");
      nameInputRef.current?.focus();
      return;
    }
    setNameError("");
    onContinue({ ...profile, username });
  };

  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : null;
  const busy = connecting || signing || savingProfile;

  return (
    <main className="character-onboarding" aria-labelledby="character-onboarding-title">
      <div className="character-onboarding-world" aria-hidden="true">
        <span className="character-onboarding-sun" />
        <span className="character-onboarding-island character-onboarding-island-one" />
        <span className="character-onboarding-island character-onboarding-island-two" />
        <span className="character-onboarding-grid" />
      </div>
      <div className="character-onboarding-backdrop" aria-hidden="true" />

      <section
        ref={panelRef}
        className="character-onboarding-panel"
        role="dialog"
        aria-modal="true"
        aria-describedby="character-onboarding-copy"
      >
        <div className="character-onboarding-preview">
          <Link className="character-onboarding-brand" href="/" aria-label="Back to BRUME World">
            <span><OnboardingBrandMark /></span>
            <strong>BRUME World</strong>
          </Link>
          <div className="character-preview-heading">
            <p>Live preview</p>
            <span>{profile.username || "BRUME Explorer"}</span>
          </div>
          <CharacterPreview profile={profile} />
          <div className="character-preview-status">
            <span />
            Ready to spawn · {SOLANA_NETWORK_LABEL}
          </div>
        </div>

        <form className="character-onboarding-form" onSubmit={handleSubmit}>
          <div className="character-onboarding-heading">
            <div>
              <p>Your explorer</p>
              <h1 id="character-onboarding-title">Make it yours.</h1>
            </div>
            <Link href="/" aria-label="Close and return home"><CloseIcon /></Link>
          </div>
          <p id="character-onboarding-copy" className="character-onboarding-copy">
            Choose a look, connect your wallet, and step inside.
          </p>

          <label className="character-onboarding-name" htmlFor="onboarding-character-name">
            <span>Explorer name</span>
            <input
              ref={nameInputRef}
              id="onboarding-character-name"
              value={profile.username}
              minLength={2}
              maxLength={20}
              autoComplete="nickname"
              spellCheck={false}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "onboarding-name-error" : undefined}
              onChange={(event) => {
                onProfileChange({ ...profile, username: event.target.value });
                if (nameError) setNameError("");
              }}
            />
          </label>
          {nameError && (
            <p id="onboarding-name-error" className="character-onboarding-error" role="alert">
              {nameError}
            </p>
          )}

          <div className="character-onboarding-options">
            <ColorChoices
              label="Skin tone"
              value={profile.avatar.skinTone}
              options={AVATAR_SKIN_OPTIONS}
              onChange={(value) => updateAvatar("skinTone", value)}
            />
            <ColorChoices
              label="Outfit"
              value={profile.avatar.outfitColor}
              options={AVATAR_COLOR_OPTIONS}
              onChange={(value) => updateAvatar("outfitColor", value)}
            />
            <ColorChoices
              label="Accent"
              value={profile.avatar.accentColor}
              options={AVATAR_ACCENT_OPTIONS}
              onChange={(value) => updateAvatar("accentColor", value)}
            />
            <ColorChoices
              label="Pants"
              value={profile.avatar.pantsColor}
              options={AVATAR_PANTS_OPTIONS}
              onChange={(value) => updateAvatar("pantsColor", value)}
            />
          </div>

          <fieldset className="character-hat-group">
            <legend>Hat</legend>
            <div>
              {AVATAR_HAT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={profile.avatar.hatStyle === option.id}
                  onClick={() => updateAvatar("hatStyle", option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {profile.avatar.hatStyle !== "none" && (
              <div className="character-hat-color" aria-label="Hat color">
                <span>Color</span>
                <div className="character-swatch-row">
                  {AVATAR_COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-label={`Hat color: ${option.label}`}
                      aria-pressed={profile.avatar.hatColor === option.id}
                      title={option.label}
                      onClick={() => updateAvatar("hatColor", option.id)}
                    >
                      <span style={{ backgroundColor: option.color }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          <div className="character-onboarding-wallet-row">
            <button
              type="button"
              className="character-onboarding-reset"
              onClick={() =>
                onProfileChange({ ...profile, avatar: { ...DEFAULT_AVATAR_STYLE } })
              }
            >
              Reset style
            </button>
            {shortWallet && (
              <button
                type="button"
                className="character-wallet-chip"
                title={walletAddress ?? undefined}
                onClick={onDisconnect}
              >
                <span /> {shortWallet} · Change
              </button>
            )}
          </div>

          {(error || notice) && (
            <p
              className={error ? "character-onboarding-error" : "character-onboarding-notice"}
              role={error ? "alert" : "status"}
            >
              {error || notice}
            </p>
          )}

          <button
            className="character-onboarding-submit"
            type="submit"
            disabled={busy}
            aria-busy={busy}
          >
            <WalletGlyph />
            <span>
              {connecting
                ? "Connecting…"
                : signing
                  ? "Waiting for signature…"
                  : savingProfile
                    ? "Saving character…"
                  : walletAddress
                    ? "Sign message & enter arena"
                    : "Connect wallet"}
            </span>
            <b aria-hidden="true">→</b>
          </button>
          <p className="character-onboarding-trust">
            Free signature. No transaction.
          </p>
        </form>
      </section>
    </main>
  );
}
