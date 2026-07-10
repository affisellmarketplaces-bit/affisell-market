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
export function devLocalhostUrlWithQuery(pathname, query = {}) {
  const qs = new URLSearchParams(query).toString()
  return devLocalhostUrl(qs ? `${pathname}?${qs}` : pathname)
}
