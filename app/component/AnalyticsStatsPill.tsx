"use client";

import { useEffect, useMemo, useState } from "react";

type AnalyticsSummary = {
  configured: boolean;
  onlineNow: number;
  views: number;
};

const REFRESH_INTERVAL_MS = 30000;

export function AnalyticsStatsPill() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const formatter = useMemo(() => new Intl.NumberFormat("en-US"), []);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const response = await fetch("/api/analytics-summary");
        if (!response.ok) throw new Error("Could not load analytics.");
        const nextSummary = (await response.json()) as AnalyticsSummary;
        if (!cancelled) setSummary(nextSummary);
      } catch {
        if (!cancelled) setSummary(null);
      }
    }

    loadSummary();
    const intervalId = window.setInterval(loadSummary, REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") loadSummary();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (summary?.configured !== true) return null;

  return (
    <div className="analytics-stats-pill" aria-live="polite">
      <div className="analytics-stats-online">
        <span aria-hidden="true" />
        <strong>{formatter.format(summary.onlineNow)}</strong>
        <span>online now</span>
      </div>
      <div className="analytics-stats-views">
        <strong>{formatter.format(summary.views)}</strong>
        <span>views so far</span>
      </div>
    </div>
  );
}
