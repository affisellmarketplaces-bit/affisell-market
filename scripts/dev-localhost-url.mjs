/**
 * Shared local dev URL helpers for Node scripts (ESM).
 * Default port 3001 — matches scripts/next-dev-port.mjs and Playwright.
 */

export const DEFAULT_DEV_PORT = 3001

export function resolveDevPort(env = process.env) {
  const n = Number(env.PORT)
  if (Number.isFinite(n) && n > 0 && n <= 65535) return Math.round(n)
  return DEFAULT_DEV_PORT
}

export function devLocalhostOrigin(env = process.env) {
  return `http://localhost:${resolveDevPort(env)}`
}

/** @param {string} [path] Path + optional query, e.g. `/dashboard?wizard=v2` */
export function devLocalhostUrl(path = "", env = process.env) {
  const origin = devLocalhostOrigin(env)
  if (!path) return origin
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * Build path + query without zsh glob issues (`?wizard=v2` in shell).
 * @param {string} pathname e.g. `/dashboard/supplier/products/new`
 * @param {Record<string, string>} [query]
 */
export function devLocalhostUrlWithQuery(pathname, query = {}, env = process.env) {
  const qs = new URLSearchParams(query).toString()
  return devLocalhostUrl(qs ? `${pathname}?${qs}` : pathname, env)
}

function localhostPortFromOrigin(origin) {
  try {
    const u = new URL(origin)
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null
    if (u.port) return Number(u.port)
    return u.protocol === "https:" ? 443 : 80
  } catch {
    return null
  }
}

/** @param {NodeJS.ProcessEnv} [env] */
export function isDevEnvPortAligned(env = process.env) {
  const port = resolveDevPort(env)
  for (const key of ["NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL", "APP_URL"]) {
    const raw = env[key]?.trim()
    if (!raw) continue
    const parsed = localhostPortFromOrigin(raw.replace(/\/$/, ""))
    if (parsed != null && parsed !== port && parsed !== 80 && parsed !== 443) return false
  }
  return true
}
