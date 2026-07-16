import "server-only"

const MIN_INTERVAL_MS = 500 // 2 req/s

let lastRequestAt = 0
let queue: Promise<void> = Promise.resolve()

async function waitRateLimit(): Promise<void> {
  const run = async () => {
    const now = Date.now()
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - now)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastRequestAt = Date.now()
  }
  queue = queue.then(run, run)
  await queue
}

function resolveProxyDispatcher(): unknown | undefined {
  const proxyUrl = process.env.PROXY_URL?.trim()
  if (!proxyUrl) return undefined
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require("undici") as {
      ProxyAgent: new (url: string) => unknown
    }
    return new undici.ProxyAgent(proxyUrl)
  } catch {
    console.error("[radar/crawler]", { result: "proxy_unavailable" })
    return undefined
  }
}

export type RadarFetchInit = RequestInit & { dispatcher?: unknown }

/** Rate-limited fetch (2 req/s) with optional PROXY_URL via undici ProxyAgent. */
export async function radarFetch(url: string, init: RadarFetchInit = {}): Promise<Response> {
  await waitRateLimit()

  const dispatcher = resolveProxyDispatcher()
  const headers = new Headers(init.headers)
  if (!headers.has("user-agent")) {
    headers.set(
      "user-agent",
      "Mozilla/5.0 (compatible; AffisellRadar/1.0; +https://affisell.com)"
    )
  }

  const opts: RadarFetchInit = { ...init, headers }
  if (dispatcher) opts.dispatcher = dispatcher

  return fetch(url, opts as RequestInit)
}
