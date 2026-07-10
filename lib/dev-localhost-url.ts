/** Default Next.js dev port (`scripts/next-dev-port.mjs`, Playwright). */
export const DEFAULT_DEV_PORT = 3001

export function resolveDevPort(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.PORT)
  if (Number.isFinite(n) && n > 0 && n <= 65535) return Math.round(n)
  return DEFAULT_DEV_PORT
}

/** `http://localhost:{PORT}` — use for tests, curl examples, script fallbacks. */
export function devLocalhostOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return `http://localhost:${resolveDevPort(env)}`
}

/** Absolute local dev URL. Path may include query (`?wizard=v2` — safe in Node, quote in zsh). */
export function devLocalhostUrl(path = "", env: NodeJS.ProcessEnv = process.env): string {
  const origin = devLocalhostOrigin(env)
  if (!path) return origin
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`
}

/** Build path + query without zsh glob issues (`?wizard=v2` in shell). */
export function devLocalhostUrlWithQuery(
  pathname: string,
  query: Record<string, string> = {},
  env: NodeJS.ProcessEnv = process.env
): string {
  const qs = new URLSearchParams(query).toString()
  return devLocalhostUrl(qs ? `${pathname}?${qs}` : pathname, env)
}

/** Parse localhost port from an origin URL; null when not localhost or invalid. */
export function localhostPortFromOrigin(origin: string): number | null {
  try {
    const u = new URL(origin)
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null
    if (u.port) return Number(u.port)
    return u.protocol === "https:" ? 443 : 80
  } catch {
    return null
  }
}

/** True when PORT matches NEXT_PUBLIC_APP_URL / NEXTAUTH_URL localhost ports. */
export function isDevEnvPortAligned(env: NodeJS.ProcessEnv = process.env): boolean {
  const port = resolveDevPort(env)
  for (const key of ["NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL", "APP_URL"] as const) {
    const raw = env[key]?.trim()
    if (!raw) continue
    const parsed = localhostPortFromOrigin(raw.replace(/\/$/, ""))
    if (parsed != null && parsed !== port && parsed !== 80 && parsed !== 443) return false
  }
  return true
}
