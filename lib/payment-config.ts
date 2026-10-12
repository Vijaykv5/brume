export function isDodoPaymentsEnabled() {
  return process.env.DODO_PAYMENTS_ENABLED?.trim().toLowerCase() === "true";
}

export function assertDodoPaymentsEnabled() {
  if (!isDodoPaymentsEnabled()) {
    throw new Error("Dodo payments are disabled.");
  }
}
