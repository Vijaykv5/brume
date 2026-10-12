import {
  parsePlayerProfile,
  type PlayerProfile,
} from "@/multiplayer/avatar-profile";

export const PLAYER_PROFILE_STORAGE_KEY = "brume-world:player-profile";

export function readStoredPlayerProfile() {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);
    return value ? parsePlayerProfile(JSON.parse(value)) : null;
  } catch {
    return null;
  }
}

export function storePlayerProfile(profile: PlayerProfile) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PLAYER_PROFILE_STORAGE_KEY,
      JSON.stringify(profile),
    );
  } catch {
    // Character persistence is best-effort when storage is unavailable.
  }
}
