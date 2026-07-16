/** Radar env — RADAR_* with MARKET_INTELLI_* then Affisell DATABASE_URL (Neon) fallback. */

export const RADAR_ENABLED =
  process.env.RADAR_ENABLED?.trim() ||
  process.env.MARKET_INTELLI_ENABLED?.trim() ||
  "false"

function isDockerLocalRadarUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname === "localhost" || u.hostname === "127.0.0.1"
    return host && (u.port === "5434" || u.port === "")
  } catch {
    return /localhost:5434|127\.0\.0\.1:5434/.test(url)
  }
}

/**
 * Prefer dedicated Radar URL; skip docker :5434; fall back to Affisell Neon DATABASE_URL.
 * Same Postgres DB + schema `market_intelli` is OK (isolated from public Affisell tables).
 */
export function resolveRadarDatabaseUrl(): string | undefined {
  const radar = process.env.RADAR_DATABASE_URL?.trim()
  if (radar && !isDockerLocalRadarUrl(radar)) return radar

  const mi = process.env.MARKET_INTELLI_DATABASE_URL?.trim()
  if (mi && !isDockerLocalRadarUrl(mi)) return mi

  const neon =
    process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim() || undefined
  return neon || undefined
}

export const RADAR_DATABASE_URL = resolveRadarDatabaseUrl()

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

export function resolveRadarBetaUserIds(): string[] {
  return RADAR_BETA_USER_IDS
}
