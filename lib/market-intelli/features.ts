/** Entitlements for Market Intelli — no DB imports (safe when flag is off). */
export function resolveMarketIntelliFeatures(userId: string, isPro: boolean): string[] {
  if (process.env.MARKET_INTELLI_ENABLED !== "true") return []

  const beta =
    process.env.MARKET_INTELLI_BETA_USER_IDS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []

  if (isPro || beta.includes(userId)) return ["market_intelli"]
  return []
}
