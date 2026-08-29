import { Redis } from "@upstash/redis";

const SITE_VIEWS_KEY = "wake:analytics:views:v1";
const SITE_ONLINE_KEY = "wake:analytics:online:v1";
const ONLINE_WINDOW_SECONDS = 90;

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

  await redis.zremrangebyscore(
    SITE_ONLINE_KEY,
    0,
    nowSeconds - ONLINE_WINDOW_SECONDS,
  );
}

export function isSiteAnalyticsEnabled() {
  return redis !== null;
}

export async function getSiteAnalyticsSummary(): Promise<SiteAnalyticsSummary> {
  if (!redis) {
    return {
      configured: false,
      onlineNow: 0,
      views: 0,
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  await cleanupOfflineVisitors(nowSeconds);

  const [views, onlineNow] = await Promise.all([
    redis.get<number>(SITE_VIEWS_KEY),
    redis.zcard(SITE_ONLINE_KEY),
  ]);

  return {
    configured: true,
    onlineNow: Number(onlineNow ?? 0),
    views: Number(views ?? 0),
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
  await Promise.all([
    redis.zadd(SITE_ONLINE_KEY, {
      score: nowSeconds,
      member: input.visitorId,
    }),
    redis.expire(SITE_ONLINE_KEY, ONLINE_WINDOW_SECONDS * 3),
    shouldCountView ? redis.incr(SITE_VIEWS_KEY) : Promise.resolve(null),
  ]);

  return {
    ok: true as const,
    status: 200,
    summary: await getSiteAnalyticsSummary(),
  };
}
