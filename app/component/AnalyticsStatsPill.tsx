"use client";

import { useEffect, useMemo, useState } from "react";
import type { MultiplayerConnectionState } from "../world/useMultiplayer";

type AnalyticsSummary = {
  configured: boolean;
  views: number;
};

const REFRESH_INTERVAL_MS = 30000;
const VISITOR_ID_STORAGE_KEY = "brume-world:visitor-id";
const VIEW_TRACKED_STORAGE_KEY = "brume-world:view-tracked";

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateVisitorId() {
  try {
    const visitorId = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (visitorId) return visitorId;

    const nextVisitorId = createVisitorId();
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, nextVisitorId);
    return nextVisitorId;
  } catch {
    return createVisitorId();
  }
}

function shouldCountSessionView() {
  try {
    if (window.sessionStorage.getItem(VIEW_TRACKED_STORAGE_KEY) === "true") {
      return false;
    }

    window.sessionStorage.setItem(VIEW_TRACKED_STORAGE_KEY, "true");
    return true;
  } catch {
    return true;
  }
}

export function AnalyticsStatsPill({
  onlineNow,
  connectionState,
}: {
  onlineNow: number;
  connectionState: MultiplayerConnectionState;
}) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const formatter = useMemo(() => new Intl.NumberFormat("en-US"), []);
  const visibleSummary = summary ?? {
    configured: true,
    views: 0,
  };
  const safeOnlineCount = Number.isFinite(onlineNow)
    ? Math.max(0, Math.trunc(onlineNow))
    : null;
  const onlineLabel =
    connectionState === "connected"
      ? "online now"
      : connectionState === "offline"
        ? "offline"
        : "connecting";

  useEffect(() => {
    let cancelled = false;
    const visitorId = getOrCreateVisitorId();

    async function trackSummary({ countView = false } = {}) {
      try {
        const response = await fetch("/api/analytics-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId, countView }),
        });
        if (!response.ok) throw new Error("Could not load analytics.");
        const nextSummary = (await response.json()) as AnalyticsSummary;
        if (!cancelled) setSummary(nextSummary);
      } catch {
        if (!cancelled) {
          setSummary((currentSummary) => currentSummary ?? {
            configured: true,
            views: 0,
          });
        }
      }
    }

    trackSummary({ countView: shouldCountSessionView() });
    const intervalId = window.setInterval(() => {
      trackSummary();
    }, REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") trackSummary();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="analytics-stats-pill" aria-live="polite">
      <div className={`analytics-stats-online is-${connectionState}`}>
        <span aria-hidden="true" />
        <strong aria-label={safeOnlineCount === null ? "no data" : undefined}>
          {safeOnlineCount === null ? "--" : formatter.format(safeOnlineCount)}
        </strong>
        <span>{onlineLabel}</span>
      </div>
      <div className="analytics-stats-views">
        <strong>{formatter.format(visibleSummary.views)}</strong>
        <span>views so far</span>
      </div>
    </div>
  );
}
