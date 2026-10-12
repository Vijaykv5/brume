import { Redis } from "@upstash/redis";
import { ensureSiteAnalyticsTables, sql } from "@/lib/db";

const SITE_VIEWS_KEY = "brume-world:analytics:views:v1";
const SITE_ONLINE_KEY = "brume-world:analytics:online:v1";
const ONLINE_WINDOW_SECONDS = 90;
const VISITOR_HASH_PEPPER = "brume-world-site-analytics-v1";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export type SiteAnalyticsSummary = {
  configured: boolean;
  onlineNow: number;
  views: number;
};

function isValidVisitorId(visitorId: unknown): visitorId is string {
  return (
    typeof visitorId === "string" &&
    visitorId.length >= 12 &&
    visitorId.length <= 96 &&
    /^[a-zA-Z0-9:_-]+$/.test(visitorId)
  );
}

async function cleanupOfflineVisitors(nowSeconds: number) {
  if (!redis) return;

  try {
    await redis.zremrangebyscore(
      SITE_ONLINE_KEY,
      0,
      nowSeconds - ONLINE_WINDOW_SECONDS,
    );
  } catch (error) {
    console.warn("Failed to clean up online visitors", error);
  }
}

async function hashVisitorId(visitorId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${VISITOR_HASH_PEPPER}:${visitorId}`),
  );
  const bytes = new Uint8Array(digest);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

async function persistDailyView(visitorId: string) {
  await ensureSiteAnalyticsTables();

  const analyticsDate = getTodayDateKey();
  const visitorHash = await hashVisitorId(visitorId);
  const insertedVisitors = await sql`
    insert into site_analytics_daily_visitors (analytics_date, visitor_hash)
    values (${analyticsDate}, ${visitorHash})
    on conflict (analytics_date, visitor_hash) do nothing
    returning visitor_hash
  `;
  const isUniqueVisitorForDay = insertedVisitors.length > 0;

  await sql`
    insert into site_analytics_daily (
      analytics_date,
      views,
      unique_visitors
    )
    values (
      ${analyticsDate},
      1,
      ${isUniqueVisitorForDay ? 1 : 0}
    )
    on conflict (analytics_date) do update
    set views = site_analytics_daily.views + 1,
        unique_visitors = site_analytics_daily.unique_visitors + ${isUniqueVisitorForDay ? 1 : 0},
        updated_at = now()
  `;
}

async function getDurableViewsTotal() {
  try {
    await ensureSiteAnalyticsTables();
    const rows = await sql`
      select coalesce(sum(views), 0) as views
      from site_analytics_daily
    `;
    const row = rows[0] as { views?: string | number } | undefined;

    return Number(row?.views ?? 0);
  } catch (error) {
    console.warn("Failed to read durable site analytics", error);
    return 0;
  }
}

async function persistDailyViewSafely(visitorId: string) {
  try {
    await persistDailyView(visitorId);
  } catch (error) {
    console.warn("Failed to persist daily site analytics", error);
  }
}

export function isSiteAnalyticsEnabled() {
  return redis !== null;
}

export async function getSiteAnalyticsSummary(): Promise<SiteAnalyticsSummary> {
  if (!redis) {
    const durableViews = await getDurableViewsTotal();

    return {
      configured: durableViews > 0,
      onlineNow: 0,
      views: durableViews,
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  await cleanupOfflineVisitors(nowSeconds);

  const durableViews = await getDurableViewsTotal();
  let views = durableViews;
  let onlineNow = 0;

  try {
    const [redisViews, redisOnlineNow] = await Promise.all([
      redis.get<number>(SITE_VIEWS_KEY),
      redis.zcard(SITE_ONLINE_KEY),
    ]);

    views = Math.max(Number(redisViews ?? 0), durableViews);
    onlineNow = Number(redisOnlineNow ?? 0);
  } catch (error) {
    console.warn("Failed to read live site analytics", error);
  }

  return {
    configured: true,
    onlineNow,
    views,
  };
}

export async function trackSiteVisit(input: {
  visitorId: unknown;
  countView: unknown;
}) {
  if (!redis) {
    return {
      ok: true as const,
      status: 200,
      summary: await getSiteAnalyticsSummary(),
    };
  }

  if (!isValidVisitorId(input.visitorId)) {
    return {
      ok: false as const,
      status: 400,
      summary: {
        configured: true,
        onlineNow: 0,
        views: 0,
      },
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  await cleanupOfflineVisitors(nowSeconds);

  const shouldCountView = input.countView === true;
  const analyticsWrites = [
    redis.zadd(SITE_ONLINE_KEY, {
      score: nowSeconds,
      member: input.visitorId,
    }),
    redis.expire(SITE_ONLINE_KEY, ONLINE_WINDOW_SECONDS * 3),
    shouldCountView ? redis.incr(SITE_VIEWS_KEY) : Promise.resolve(null),
    shouldCountView ? persistDailyViewSafely(input.visitorId) : Promise.resolve(null),
  ];

  const writeResults = await Promise.allSettled(analyticsWrites);
  const failedWrite = writeResults.find((result) => result.status === "rejected");

  if (failedWrite) {
    console.warn("Failed to write live site analytics", failedWrite.reason);
  }

  return {
    ok: true as const,
    status: 200,
    summary: await getSiteAnalyticsSummary(),
  };
}
