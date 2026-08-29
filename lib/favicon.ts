import { normalizeDomain } from "@/lib/buildings";

export function getWebsiteFaviconUrl(domain: string, size = 64) {
  const normalizedDomain = normalizeDomain(domain);
  const faviconSize = Math.max(16, Math.min(size, 256));

  if (!normalizedDomain) return "";

  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    normalizedDomain,
  )}&sz=${faviconSize}`;
}
