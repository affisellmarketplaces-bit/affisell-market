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
