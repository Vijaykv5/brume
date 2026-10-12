import { Redis } from "@upstash/redis";
import {
  parsePlayerProfile,
  type PlayerProfile,
} from "@/multiplayer/avatar-profile";

const PLAYER_PROFILE_KEY_PREFIX = "brume-world:player-profile:v1";

export type StoredPlayerProfile = {
  profile: PlayerProfile;
  updatedAt: number;
};

export type PlayerProfileStore = {
  get: (walletAddress: string) => Promise<PlayerProfile | null>;
  set: (walletAddress: string, profile: PlayerProfile) => Promise<void>;
};

function profileKey(walletAddress: string) {
  return `${PLAYER_PROFILE_KEY_PREFIX}:${walletAddress}`;
}

export function createPlayerProfileStore(): PlayerProfileStore | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  return {
    async get(walletAddress) {
      const stored = await redis.get<StoredPlayerProfile>(profileKey(walletAddress));
      return parsePlayerProfile(stored?.profile);
    },
    async set(walletAddress, profile) {
      const validProfile = parsePlayerProfile(profile);
      if (!validProfile) throw new Error("The player profile is not valid.");
      await redis.set(profileKey(walletAddress), {
        profile: validProfile,
        updatedAt: Date.now(),
      } satisfies StoredPlayerProfile);
    },
  };
}
