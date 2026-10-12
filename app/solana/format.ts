import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export type FormattedSol = {
  display: string;
  raw: string;
  ariaLabel: string;
};

export function formatLamports(
  lamports: number | null | undefined,
  context: "compact" | "detailed" = "compact",
): FormattedSol {
  if (lamports == null || !Number.isFinite(lamports)) {
    return { display: "--", raw: "", ariaLabel: "balance unavailable" };
  }

  const safeLamports = Math.max(0, Math.round(lamports));
  if (safeLamports === 0) {
    return { display: "0", raw: "0", ariaLabel: "0 SOL" };
  }

  const value = safeLamports / LAMPORTS_PER_SOL;
  const maximumFractionDigits = context === "detailed" ? 9 : 4;
  const minimumVisible = 10 ** -maximumFractionDigits;
  const raw = value.toFixed(9).replace(/\.?0+$/, "");
  if (value < minimumVisible) {
    return {
      display: `<${minimumVisible.toFixed(maximumFractionDigits)}`,
      raw,
      ariaLabel: `${raw} SOL`,
    };
  }

  return {
    display: new Intl.NumberFormat("en-US", {
      maximumFractionDigits,
    }).format(value),
    raw,
    ariaLabel: `${raw} SOL`,
  };
}

export function parseSolAmount(value: string) {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{0,9})?$/.test(normalized)) return null;
  const sol = Number(normalized);
  if (!Number.isFinite(sol) || sol <= 0) return null;
  const lamports = Math.round(sol * LAMPORTS_PER_SOL);
  return Number.isSafeInteger(lamports) && lamports > 0 ? lamports : null;
}
