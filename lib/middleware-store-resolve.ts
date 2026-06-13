import type { NextRequest } from "next/server"

import { storePublicPrefix, type StorefrontRole } from "@/lib/custom-domain-path"
import { parseStoreSlugFromStoreHost } from "@/lib/store-host-suffix"

export type MiddlewareStoreResolve = {
  found: true
  slug: string
  role: StorefrontRole
  storePrefix: string
}

const STORE_CTX_COOKIE = "affisell_store_ctx"
const MEMORY_TTL_MS = 10 * 60_000
const MAX_MEMORY_ENTRIES = 512

type MemoryEntry = { payload: MiddlewareStoreResolve; expiresAt: number }

const memoryCache = new Map<string, MemoryEntry>()

function pruneMemoryCache(now: number) {
  if (memoryCache.size <= MAX_MEMORY_ENTRIES) return
  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt <= now) memoryCache.delete(key)
    if (memoryCache.size <= MAX_MEMORY_ENTRIES * 0.8) break
  }
}

export function rememberStoreResolve(host: string, payload: MiddlewareStoreResolve) {
  memoryCache.set(host, { payload, expiresAt: Date.now() + MEMORY_TTL_MS })
}

function readMemoryResolve(host: string): MiddlewareStoreResolve | null {
  const entry = memoryCache.get(host)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(host)
    return null
  }
  return entry.payload
}

type StoreCtxCookie = {
  host: string
  slug: string
  role: StorefrontRole
  storePrefix: string
}

export function readStoreResolveCookie(req: NextRequest, host: string): MiddlewareStoreResolve | null {
  const raw = req.cookies.get(STORE_CTX_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoreCtxCookie
    if (parsed.host !== host || !parsed.slug || !parsed.role || !parsed.storePrefix) return null
    return {
      found: true,
      slug: parsed.slug,
      role: parsed.role,
      storePrefix: parsed.storePrefix,
    }
  } catch {
    return null
  }
}

export function storeResolveCookieValue(host: string, payload: MiddlewareStoreResolve): string {
  const value: StoreCtxCookie = {
    host,
    slug: payload.slug,
    role: payload.role,
    storePrefix: payload.storePrefix,
  }
  return JSON.stringify(value)
}

export const STORE_RESOLVE_COOKIE_NAME = STORE_CTX_COOKIE
export const STORE_RESOLVE_COOKIE_MAX_AGE_SEC = 86_400

/** Instant resolve for `{slug}.shops.*` hosts — affiliate routing only (invalid slug 404s in app). */
export function resolveAffisellSubdomainHost(host: string): MiddlewareStoreResolve | null {
  const slug = parseStoreSlugFromStoreHost(host)
  if (!slug) return null
  return {
    found: true,
    slug,
    role: "AFFILIATE",
    storePrefix: storePublicPrefix(slug, "AFFILIATE"),
  }
}

export async function resolveStoreHostForMiddleware(
  req: NextRequest,
  host: string,
  fetchRemote: () => Promise<MiddlewareStoreResolve | null>
): Promise<MiddlewareStoreResolve | null> {
  const fromCookie = readStoreResolveCookie(req, host)
  if (fromCookie) {
    rememberStoreResolve(host, fromCookie)
    return fromCookie
  }

  const fromMemory = readMemoryResolve(host)
  if (fromMemory) return fromMemory

  const optimistic = resolveAffisellSubdomainHost(host)
  if (optimistic) {
    rememberStoreResolve(host, optimistic)
    return optimistic
  }

  const remote = await fetchRemote()
  if (remote) {
    rememberStoreResolve(host, remote)
    return remote
  }

  pruneMemoryCache(Date.now())
  return null
}

/** Test helper */
export function clearStoreResolveMemoryCacheForTests() {
  memoryCache.clear()
}
