/** Radar env with 1-month MARKET_INTELLI_* fallback during transition. */
export function resolveRadarEnabled(): string | undefined {
  return process.env.RADAR_ENABLED?.trim() || process.env.MARKET_INTELLI_ENABLED?.trim()
}

export function resolveRadarDatabaseUrl(): string | undefined {
  return (
    process.env.RADAR_DATABASE_URL?.trim() || process.env.MARKET_INTELLI_DATABASE_URL?.trim()
  )
}

export function resolveRadarBetaUserIds(): string {
  return (
    process.env.RADAR_BETA_USER_IDS?.trim() ||
    process.env.MARKET_INTELLI_BETA_USER_IDS?.trim() ||
    ""
  )
}
