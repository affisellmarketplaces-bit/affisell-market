/** Radar env — RADAR_* with 1-month MARKET_INTELLI_* fallback. */

export const RADAR_ENABLED =
  process.env.RADAR_ENABLED?.trim() ||
  process.env.MARKET_INTELLI_ENABLED?.trim() ||
  "false"

export const RADAR_DATABASE_URL =
  process.env.RADAR_DATABASE_URL?.trim() ||
  process.env.MARKET_INTELLI_DATABASE_URL?.trim() ||
  undefined

export const RADAR_BETA_USER_IDS = (
  process.env.RADAR_BETA_USER_IDS?.trim() ||
  process.env.MARKET_INTELLI_BETA_USER_IDS?.trim() ||
  ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

export function resolveRadarEnabled(): string {
  return RADAR_ENABLED
}

export function resolveRadarDatabaseUrl(): string | undefined {
  return RADAR_DATABASE_URL
}

export function resolveRadarBetaUserIds(): string[] {
  return RADAR_BETA_USER_IDS
}
