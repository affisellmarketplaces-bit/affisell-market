import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import {
  isBlockedOnCustomDomain,
  mapCustomDomainPath,
  type StorefrontRole,
} from "@/lib/custom-domain-path"
import { isPlatformHost, requestHost } from "@/lib/custom-domain-host"
import {
  CUSTOM_DOMAIN_HEADER,
  STORE_ROLE_HEADER,
  STORE_SLUG_HEADER,
} from "@/lib/storefront-request-headers"
import { localeFromPathname, pathnameWithoutLocale } from "@/lib/locale-path"

type ResolvePayload = {
  found: boolean
  slug?: string
  role?: StorefrontRole
  storePrefix?: string
}

function platformOriginForResolve(req: NextRequest): string {
  const fromEnv =
    process.env.AFFISELL_PLATFORM_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "")
  if (fromEnv) return fromEnv.replace(/\/$/, "")

  const host = requestHost(req)
  if (!isPlatformHost(host)) {
    const port = req.nextUrl.port || process.env.PORT?.trim() || "3001"
    return `http://127.0.0.1:${port}`
  }

  return req.nextUrl.origin
}

async function fetchStoreResolve(host: string, origin: string): Promise<ResolvePayload | null> {
  try {
    const u = new URL("/api/store/resolve-host", origin)
    u.searchParams.set("host", host)
    const res = await fetch(u.toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    return (await res.json()) as ResolvePayload
  } catch {
    return null
  }
}

function redirectToPlatformApp(req: NextRequest, barePath: string): NextResponse {
  const origin = platformOriginForResolve(req)
  const locale = localeFromPathname(req.nextUrl.pathname)
  const path = locale ? `/${locale}${barePath}` : barePath
  const target = new URL(path + (req.nextUrl.search || ""), origin)
  return NextResponse.redirect(target, 307)
}

export async function tryCustomDomainMiddleware(
  req: NextRequest
): Promise<NextResponse | null> {
  const host = requestHost(req)
  if (isPlatformHost(host)) return null

  const bare = pathnameWithoutLocale(req.nextUrl.pathname)
  if (bare.startsWith("/api/")) return null

  const resolved = await fetchStoreResolve(host, platformOriginForResolve(req))
  if (!resolved?.found || !resolved.slug || !resolved.role || !resolved.storePrefix) {
    return null
  }

  if (isBlockedOnCustomDomain(bare)) {
    return redirectToPlatformApp(req, bare)
  }

  const mapped = mapCustomDomainPath(bare, resolved.slug, resolved.role)
  if (!mapped) {
    return redirectToPlatformApp(req, bare)
  }

  if (mapped !== bare) {
    const url = req.nextUrl.clone()
    const locale = localeFromPathname(req.nextUrl.pathname)
    url.pathname = locale ? `/${locale}${mapped}` : mapped
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set(CUSTOM_DOMAIN_HEADER, "1")
    requestHeaders.set(STORE_SLUG_HEADER, resolved.slug)
    requestHeaders.set(STORE_ROLE_HEADER, resolved.role)
    requestHeaders.set("x-affisell-pathname", url.pathname)
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(CUSTOM_DOMAIN_HEADER, "1")
  requestHeaders.set(STORE_SLUG_HEADER, resolved.slug)
  requestHeaders.set(STORE_ROLE_HEADER, resolved.role)
  requestHeaders.set("x-affisell-pathname", req.nextUrl.pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}
