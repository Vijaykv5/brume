import { Redis } from "@upstash/redis";
import type { SavedBuilding } from "@/lib/buildings";

const BUILDINGS_CACHE_KEY = "wake:buildings:active:v2";
const BUILDINGS_CACHE_VERSION_KEY = "wake:buildings:version:v2";
const BUILDINGS_CACHE_TTL_SECONDS = 60;

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export function isBuildingsCacheEnabled() {
  return redis !== null;
}

export async function getCachedBuildings() {
  if (!redis) return null;

  try {
    return await redis.get<SavedBuilding[]>(BUILDINGS_CACHE_KEY);
  } catch (error) {
    console.warn("Failed to read buildings cache", error);
    return null;
  }
}

export async function setCachedBuildings(buildings: SavedBuilding[]) {
  if (!redis) return;

  try {
    await redis.set(BUILDINGS_CACHE_KEY, buildings, {
      ex: BUILDINGS_CACHE_TTL_SECONDS,
    });
  } catch (error) {
    console.warn("Failed to write buildings cache", error);
  }
}

export async function clearCachedBuildings() {
  if (!redis) return;

  try {
    await redis.del(BUILDINGS_CACHE_KEY);
  } catch (error) {
    console.warn("Failed to clear buildings cache", error);
  }
}

export async function getBuildingsCacheVersion() {
  if (!redis) return null;

  try {
    const version = await redis.get<number>(BUILDINGS_CACHE_VERSION_KEY);
    return Number(version ?? 0);
  } catch (error) {
    console.warn("Failed to read buildings cache version", error);
    return null;
  }
}

export async function bumpBuildingsCacheVersion() {
  if (!redis) return null;

  try {
    return await redis.incr(BUILDINGS_CACHE_VERSION_KEY);
  } catch (error) {
    console.warn("Failed to bump buildings cache version", error);
    return null;
  }
}
