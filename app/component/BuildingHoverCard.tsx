"use client";

import { useState } from "react";
import { getWebsiteFaviconUrl } from "@/lib/favicon";

const clickFormatter = new Intl.NumberFormat("en-US");

export type BuildingHoverCardData = {
  id: string;
  name: string;
  domain: string;
  clickCount: number;
  logoUrl?: string;
};

export function BuildingHoverCard({
  building,
}: {
  building: BuildingHoverCardData | null;
}) {
  const [failedImageKey, setFailedImageKey] = useState("");

  if (!building) return null;

  const preferredIconUrl = building.logoUrl || getWebsiteFaviconUrl(building.domain, 96);
  const imageKey = `${building.id}:${preferredIconUrl}`;
  const iconUrl = failedImageKey === imageKey ? "" : preferredIconUrl;

  return (
    <aside className="building-hover-card" aria-live="polite">
      <div className="building-hover-icon" aria-hidden="true">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt=""
            onError={() => setFailedImageKey(imageKey)}
          />
        ) : (
          <span>{building.name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="building-hover-copy">
        <strong>{building.name}</strong>
        <span>{building.domain}</span>
      </div>
      <div className="building-hover-clicks">
        <span aria-hidden="true">
          <svg viewBox="0 0 40 40" focusable="false">
            <path d="M15.6 19.7V9.8a2.4 2.4 0 0 1 4.8 0v11.5" />
            <path d="M20.4 17.8v-1.7a2.25 2.25 0 0 1 4.5 0v5" />
            <path d="M24.9 18.5v-.8a2.2 2.2 0 0 1 4.4 0v4.5" />
            <path d="M29.3 21.4v-1.6a2.15 2.15 0 0 1 4.3 0v5.7c0 5.7-4.5 9.7-10.5 9.7h-3.2c-4.2 0-6.5-1.8-9-5.2l-5.1-7a2.5 2.5 0 0 1 .5-3.5 2.7 2.7 0 0 1 3.7.3l5.6 5.9v-6" />
          </svg>
        </span>
        <strong>{clickFormatter.format(building.clickCount)}</strong>
        <span>clicks</span>
      </div>
    </aside>
  );
}
