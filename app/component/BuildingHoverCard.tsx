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
        <span aria-hidden="true">+</span>
        <strong>{clickFormatter.format(building.clickCount)}</strong>
        <span>clicks</span>
      </div>
    </aside>
  );
}
