/** Custom domain host helpers — safe for Edge middleware (no Prisma). */

import { isAffisellStoreSubdomainHost } from "@/lib/store-host-suffix"

export function normalizeRequestHost(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const first = raw.split(",")[0]?.trim().toLowerCase()
  if (!first) return null
  const withoutPort = first.replace(/:\d+$/, "")
  const host = withoutPort.replace(/\.$/, "")
  if (!host || !/^[a-z0-9.-]+$/.test(host) || host.length > 253) return null
  return host
}

function hostFromUrl(url: string | undefined): string | null {
  if (!url?.trim()) return null
  try {
    return normalizeRequestHost(new URL(url.trim()).hostname)
  } catch {
    return null
  }
}

function platformHostsFromEnv(): string[] {
  const out: string[] = []
  const list = process.env.AFFISELL_PLATFORM_HOSTS?.split(",") ?? []
  for (const item of list) {
    const h = normalizeRequestHost(item) ?? hostFromUrl(item)
    if (h) out.push(h)
  }
  const cname = process.env.STORE_CNAME_TARGET?.trim()
  const cnameHost = hostFromUrl(cname) ?? normalizeRequestHost(cname)
  if (cnameHost) out.push(cnameHost)
  const app = hostFromUrl(process.env.NEXT_PUBLIC_APP_URL)
  if (app) out.push(app)
  const vercel = normalizeRequestHost(process.env.VERCEL_URL)
  if (vercel) out.push(vercel)
  return out
}

const STATIC_PLATFORM_SUFFIXES = [".vercel.app", ".localhost"] as const

const STATIC_PLATFORM_EXACT = new Set([
  "localhost",
  "127.0.0.1",
  "affisell.com",
  "www.affisell.com",
])

let cachedPlatformHosts: Set<string> | null = null

function platformHostSet(): Set<string> {
  if (!cachedPlatformHosts) {
    cachedPlatformHosts = new Set([...STATIC_PLATFORM_EXACT, ...platformHostsFromEnv()])
  }
  return cachedPlatformHosts
}

/** True when the request should use the main Affisell app (not a merchant custom domain). */
export function isPlatformHost(hostRaw: string | null | undefined): boolean {
  const host = normalizeRequestHost(hostRaw)
  if (!host) return true
  /** `{slug}.shops.localhost` ends with `.localhost` but is a merchant storefront host. */
  if (isAffisellStoreSubdomainHost(host)) return false
  if (STATIC_PLATFORM_EXACT.has(host)) return true
  for (const suffix of STATIC_PLATFORM_SUFFIXES) {
    if (host === suffix.slice(1) || host.endsWith(suffix)) return true
  }
  if (platformHostSet().has(host)) return true
  return false
}

export function requestHost(req: { headers: { get(name: string): string | null }; nextUrl: { host: string } }): string {
  const forwarded = req.headers.get("x-forwarded-host")
  const host = normalizeRequestHost(forwarded) ?? normalizeRequestHost(req.nextUrl.host)
  return host ?? req.nextUrl.host
}
