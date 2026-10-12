"use client";

import { useEffect, useRef } from "react";
import type { PlayerInputState } from "./types";

const INITIAL_INPUT: PlayerInputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  run: false,
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function movementControlForKey(key: string): keyof PlayerInputState | null {
  switch (key.toLowerCase()) {
    case "w":
    case "arrowup":
      return "forward";
    case "s":
    case "arrowdown":
      return "backward";
    case "a":
    case "arrowleft":
      return "left";
    case "d":
    case "arrowright":
      return "right";
    case "shift":
      return "run";
    default:
      return null;
  }
}

export function useWorldKeyboard({
  enabled,
  onInteract,
  onEscape,
}: {
  enabled: boolean;
  onInteract: () => void;
  onEscape: () => void;
}) {
  const inputRef = useRef<PlayerInputState>({ ...INITIAL_INPUT });

  useEffect(() => {
    if (!enabled) inputRef.current = { ...INITIAL_INPUT };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape();
        return;
      }

      if (!enabled || isEditableTarget(event.target)) return;

      if (event.key.toLowerCase() === "e" && !event.repeat) {
        event.preventDefault();
        onInteract();
        return;
      }

      const control = movementControlForKey(event.key);
      if (!control) return;

      event.preventDefault();
      inputRef.current[control] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const control = movementControlForKey(event.key);
      if (!control) return;

      inputRef.current[control] = false;
    };

    const clearInput = () => {
      inputRef.current = { ...INITIAL_INPUT };
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInput);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
      clearInput();
    };
  }, [enabled, onEscape, onInteract]);

  return inputRef;
}
