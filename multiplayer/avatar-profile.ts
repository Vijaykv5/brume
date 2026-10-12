export const AVATAR_SKIN_OPTIONS = [
  { id: "warm", label: "Warm", color: "#f0bd88", accent: "#d98d62" },
  { id: "golden", label: "Golden", color: "#c98b5a", accent: "#a96b42" },
  { id: "deep", label: "Deep", color: "#74452f", accent: "#573223" },
  { id: "rose", label: "Rose", color: "#e8a184", accent: "#c77a62" },
] as const;

export const AVATAR_COLOR_OPTIONS = [
  { id: "teal", label: "Teal", color: "#176f63" },
  { id: "coral", label: "Coral", color: "#d85d4d" },
  { id: "violet", label: "Violet", color: "#7458b8" },
  { id: "sky", label: "Sky", color: "#2d83b8" },
  { id: "gold", label: "Gold", color: "#c98b23" },
  { id: "charcoal", label: "Charcoal", color: "#34454a" },
] as const;

export const AVATAR_ACCENT_OPTIONS = [
  { id: "lime", label: "Lime", color: "#a8e46b" },
  { id: "cream", label: "Cream", color: "#f3efe5" },
  { id: "rose", label: "Rose", color: "#f092a5" },
  { id: "cyan", label: "Cyan", color: "#72d8df" },
] as const;

export const AVATAR_PANTS_OPTIONS = [
  { id: "navy", label: "Navy", color: "#263c4a" },
  { id: "forest", label: "Forest", color: "#304f3e" },
  { id: "stone", label: "Stone", color: "#5c6465" },
  { id: "plum", label: "Plum", color: "#4e3a59" },
] as const;

export const AVATAR_HAT_OPTIONS = [
  { id: "none", label: "No hat" },
  { id: "cap", label: "Cap" },
  { id: "beanie", label: "Beanie" },
  { id: "bucket", label: "Bucket" },
] as const;

export type AvatarSkinTone = (typeof AVATAR_SKIN_OPTIONS)[number]["id"];
export type AvatarColor = (typeof AVATAR_COLOR_OPTIONS)[number]["id"];
export type AvatarAccent = (typeof AVATAR_ACCENT_OPTIONS)[number]["id"];
export type AvatarPants = (typeof AVATAR_PANTS_OPTIONS)[number]["id"];
export type AvatarHat = (typeof AVATAR_HAT_OPTIONS)[number]["id"];

export type AvatarStyle = {
  skinTone: AvatarSkinTone;
  outfitColor: AvatarColor;
  accentColor: AvatarAccent;
  pantsColor: AvatarPants;
  hatStyle: AvatarHat;
  hatColor: AvatarColor;
};

export type PlayerProfile = {
  username: string;
  avatar: AvatarStyle;
};

export const DEFAULT_AVATAR_STYLE: AvatarStyle = {
  skinTone: "warm",
  outfitColor: "teal",
  accentColor: "lime",
  pantsColor: "navy",
  hatStyle: "none",
  hatColor: "teal",
};

export function resolveAvatarStyle(value: unknown): AvatarStyle {
  if (!value || typeof value !== "object") return { ...DEFAULT_AVATAR_STYLE };

  const style = value as Record<string, unknown>;
  return {
    skinTone: isOptionId(style.skinTone, AVATAR_SKIN_OPTIONS)
      ? style.skinTone
      : DEFAULT_AVATAR_STYLE.skinTone,
    outfitColor: isOptionId(style.outfitColor, AVATAR_COLOR_OPTIONS)
      ? style.outfitColor
      : DEFAULT_AVATAR_STYLE.outfitColor,
    accentColor: isOptionId(style.accentColor, AVATAR_ACCENT_OPTIONS)
      ? style.accentColor
      : DEFAULT_AVATAR_STYLE.accentColor,
    pantsColor: isOptionId(style.pantsColor, AVATAR_PANTS_OPTIONS)
      ? style.pantsColor
      : DEFAULT_AVATAR_STYLE.pantsColor,
    hatStyle: isOptionId(style.hatStyle, AVATAR_HAT_OPTIONS)
      ? style.hatStyle
      : DEFAULT_AVATAR_STYLE.hatStyle,
    hatColor: isOptionId(style.hatColor, AVATAR_COLOR_OPTIONS)
      ? style.hatColor
      : DEFAULT_AVATAR_STYLE.hatColor,
  };
}

const USERNAME_PATTERN = /^[\p{L}\p{N} _.-]+$/u;

function isOptionId<T extends { id: string }>(
  value: unknown,
  options: readonly T[],
): value is T["id"] {
  return typeof value === "string" && options.some((option) => option.id === value);
}

export function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidUsername(value: string) {
  const normalized = normalizeUsername(value);
  return (
    normalized.length >= 2 &&
    normalized.length <= 20 &&
    USERNAME_PATTERN.test(normalized)
  );
}

export function parsePlayerProfile(value: unknown): PlayerProfile | null {
  if (!value || typeof value !== "object") return null;

  const profile = value as Record<string, unknown>;
  const avatar = profile.avatar;
  if (!avatar || typeof avatar !== "object" || typeof profile.username !== "string") {
    return null;
  }

  const style = avatar as Record<string, unknown>;
  const username = normalizeUsername(profile.username);
  if (
    !isValidUsername(username) ||
    !isOptionId(style.skinTone, AVATAR_SKIN_OPTIONS) ||
    !isOptionId(style.outfitColor, AVATAR_COLOR_OPTIONS) ||
    !isOptionId(style.accentColor, AVATAR_ACCENT_OPTIONS) ||
    !isOptionId(style.pantsColor, AVATAR_PANTS_OPTIONS) ||
    !isOptionId(style.hatStyle, AVATAR_HAT_OPTIONS) ||
    !isOptionId(style.hatColor, AVATAR_COLOR_OPTIONS)
  ) {
    return null;
  }

  return {
    username,
    avatar: {
      skinTone: style.skinTone,
      outfitColor: style.outfitColor,
      accentColor: style.accentColor,
      pantsColor: style.pantsColor,
      hatStyle: style.hatStyle,
      hatColor: style.hatColor,
    },
  };
}

export function createDefaultPlayerProfile(username = "BRUME Explorer"): PlayerProfile {
  return { username, avatar: { ...DEFAULT_AVATAR_STYLE } };
}

export function getAvatarColor(
  options: readonly { id: string; color: string }[],
  id: string,
) {
  return options.find((option) => option.id === id)?.color ?? options[0].color;
}
