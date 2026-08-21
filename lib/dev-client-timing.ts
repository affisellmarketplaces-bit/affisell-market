/** Dev-only client timing — no effect in production builds. */

export function isLocalDevRuntime(): boolean {
  return process.env.NODE_ENV === "development"
}

/** Supplier header poll — slower in dev to reduce Neon round-trips while coding. */
export function merchantNotificationsPollMs(role: "SUPPLIER" | "AFFILIATE"): number {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return 60_000
  }
  if (isLocalDevRuntime()) {
    return role === "SUPPLIER" ? 60_000 : 45_000
  }
  return role === "SUPPLIER" ? 15_000 : 30_000
}
