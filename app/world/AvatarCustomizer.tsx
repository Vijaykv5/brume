"use client";

import { useEffect, useRef, useState } from "react";
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

type AvatarCustomizerProps = {
  profile: PlayerProfile;
  onSave: (profile: PlayerProfile) => void;
  onClose: () => void;
};

function ColorChoices<T extends string>({
  label,
  value,
  options,
  optionPrefix,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string; color: string }[];
  optionPrefix: string;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="avatar-customizer-fieldset">
      <legend>{label}</legend>
      <div className="avatar-color-options">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="avatar-color-option"
            aria-label={`${label}: ${option.label}`}
            aria-pressed={value === option.id}
            data-avatar-option={`${optionPrefix}-${option.id}`}
            onClick={() => onChange(option.id)}
          >
            <span style={{ backgroundColor: option.color }} aria-hidden="true" />
            <small>{option.label}</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AvatarCustomizer({
  profile,
  onSave,
  onClose,
}: AvatarCustomizerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState(profile.username);
  const [avatar, setAvatar] = useState<AvatarStyle>({ ...profile.avatar });
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          "input:not([disabled]), button:not([disabled])",
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

    nameInputRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const updateAvatar = <TKey extends keyof AvatarStyle>(
    key: TKey,
    value: AvatarStyle[TKey],
  ) => setAvatar((current) => ({ ...current, [key]: value }));

  return (
    <section
      ref={panelRef}
      className="avatar-customizer-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-customizer-title"
    >
      <div className="avatar-customizer-header">
        <div>
          <p>Your explorer</p>
          <h2 id="avatar-customizer-title">Make it yours</h2>
        </div>
        <button
          type="button"
          className="world-interaction-close"
          aria-label="Close character editor"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const nextUsername = normalizeUsername(username);
          if (!isValidUsername(nextUsername)) {
            setNameError("Use 2–20 letters, numbers, spaces, dots, dashes, or underscores.");
            nameInputRef.current?.focus();
            return;
          }
          onSave({ username: nextUsername, avatar });
        }}
      >
        <label className="avatar-name-field" htmlFor="avatar-name">
          <span>Display name</span>
          <input
            ref={nameInputRef}
            id="avatar-name"
            name="avatar-name"
            value={username}
            minLength={2}
            maxLength={20}
            autoComplete="nickname"
            spellCheck={false}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "avatar-name-error" : undefined}
            onChange={(event) => {
              setUsername(event.target.value);
              if (nameError) setNameError("");
            }}
          />
        </label>
        {nameError && (
          <p id="avatar-name-error" className="avatar-name-error" role="alert">
            {nameError}
          </p>
        )}

        <ColorChoices
          label="Skin tone"
          value={avatar.skinTone}
          options={AVATAR_SKIN_OPTIONS}
          optionPrefix="skin"
          onChange={(value) => updateAvatar("skinTone", value)}
        />
        <ColorChoices
          label="Outfit"
          value={avatar.outfitColor}
          options={AVATAR_COLOR_OPTIONS}
          optionPrefix="outfit"
          onChange={(value) => updateAvatar("outfitColor", value)}
        />
        <ColorChoices
          label="Accent"
          value={avatar.accentColor}
          options={AVATAR_ACCENT_OPTIONS}
          optionPrefix="accent"
          onChange={(value) => updateAvatar("accentColor", value)}
        />
        <ColorChoices
          label="Pants"
          value={avatar.pantsColor}
          options={AVATAR_PANTS_OPTIONS}
          optionPrefix="pants"
          onChange={(value) => updateAvatar("pantsColor", value)}
        />

        <fieldset className="avatar-customizer-fieldset">
          <legend>Hat</legend>
          <div className="avatar-hat-options">
            {AVATAR_HAT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={avatar.hatStyle === option.id}
                data-avatar-option={`hat-${option.id}`}
                onClick={() => updateAvatar("hatStyle", option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        {avatar.hatStyle !== "none" && (
          <ColorChoices
            label="Hat color"
            value={avatar.hatColor}
            options={AVATAR_COLOR_OPTIONS}
            optionPrefix="hat-color"
            onChange={(value) => updateAvatar("hatColor", value)}
          />
        )}

        <div className="avatar-customizer-actions">
          <button
            type="button"
            className="avatar-customizer-reset"
            onClick={() => setAvatar({ ...DEFAULT_AVATAR_STYLE })}
          >
            Reset style
          </button>
          <div>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="avatar-customizer-save">
              Save changes
            </button>
          </div>
        </div>
      </form>
      <p className="avatar-customizer-hint">Your look is saved on this device and shared live.</p>
    </section>
  );
}
