import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

import {
  AFFILIATE_CATALOG_PATH,
  isMarketplaceListingPath,
  resolveLegacyMarketplaceIndexPath,
} from "@/lib/affiliate-routes"

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

const FORCED_CUSTOMER_HEADER = "x-affisell-view-role"

function secureSessionCookieForRequest(req: NextRequest): boolean {
  return req.nextUrl.protocol === "https:"
}

function loginAffiliateUrl(req: NextRequest, pathWithSearch: string) {
  const u = new URL("/login/affiliate", req.url)
  u.searchParams.set("callbackUrl", pathWithSearch)
  return u
}

function loginSupplierUrl(req: NextRequest, pathWithSearch: string) {
  const u = new URL("/login/supplier", req.url)
  u.searchParams.set("callbackUrl", pathWithSearch)
  return u
}

/** Legacy `/auth/signin` and `?role=` → clean routes. */
function legacyAuthRedirect(req: NextRequest): NextResponse | null {
  const { pathname, searchParams } = req.nextUrl
  const callback = searchParams.get("callbackUrl")

  if (pathname === "/auth/signin/affiliate") {
    const u = loginAffiliateUrl(req, callback ?? AFFILIATE_CATALOG_PATH)
    return NextResponse.redirect(u)
  }
  if (pathname === "/auth/signin/supplier") {
    const u = loginSupplierUrl(req, callback ?? "/dashboard/supplier")
    return NextResponse.redirect(u)
  }
  if (pathname !== "/auth/signin") return null

  const role = searchParams.get("role")?.trim().toLowerCase()
  if (role === "affiliate") {
    return NextResponse.redirect(loginAffiliateUrl(req, callback ?? AFFILIATE_CATALOG_PATH))
  }
  if (role === "supplier") {
    return NextResponse.redirect(loginSupplierUrl(req, callback ?? "/dashboard/supplier"))
  }
  const u = new URL("/login", req.url)
  if (callback) u.searchParams.set("callbackUrl", callback)
  return NextResponse.redirect(u)
}

function withForcedCustomerRole(req: NextRequest): NextResponse {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(FORCED_CUSTOMER_HEADER, "customer")
  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  const legacy = legacyAuthRedirect(req)
  if (legacy) return legacy

  if (pathname === "/shop") {
    const u = req.nextUrl.clone()
    u.pathname = "/shops"
    return NextResponse.redirect(u, 308)
  }

  if (pathname.startsWith("/shop/")) {
    const rest = pathname.slice("/shop/".length)
    const u = req.nextUrl.clone()
    u.pathname = rest ? `/shops/${rest}` : "/shops"
    return NextResponse.redirect(u, 308)
  }

  if (pathname.startsWith("/store/") && !pathname.startsWith("/store/supplier/")) {
    const slug = pathname.slice("/store/".length).split("/")[0]
    if (slug) {
      const u = req.nextUrl.clone()
      u.pathname = `/shops/${slug}`
      return NextResponse.redirect(u, 308)
    }
  }

  if (pathname === "/shops" || pathname.startsWith("/shops/")) {
    return withForcedCustomerRole(req)
  }

  if (!secret) return NextResponse.next()

  const path = req.nextUrl.pathname + req.nextUrl.search

  const token = await getToken({
    req,
    secret,
    secureCookie: secureSessionCookieForRequest(req),
  })
  const role = typeof token?.role === "string" ? token.role : undefined
  const loggedIn = Boolean(token?.sub)

  if (pathname === "/" && role === "AFFILIATE") {
    return NextResponse.redirect(new URL("/dashboard/affiliate", req.url))
  }

  if (pathname === "/" && role === "SUPPLIER") {
    return NextResponse.redirect(new URL("/dashboard/supplier", req.url))
  }

  if (pathname === "/marketplace") {
    const u = req.nextUrl.clone()
    u.pathname = resolveLegacyMarketplaceIndexPath(role)
    u.search = ""
    return NextResponse.redirect(u, 308)
  }

  if (isMarketplaceListingPath(pathname)) {
    return withForcedCustomerRole(req)
  }

  const isSupplierArea = pathname === "/dashboard/supplier" || pathname.startsWith("/dashboard/supplier/")
  const isAffiliateArea =
    pathname === "/dashboard/affiliate" ||
    pathname.startsWith("/dashboard/affiliate/") ||
    pathname.startsWith("/affiliate/")

  if (isSupplierArea) {
    if (!loggedIn) return NextResponse.redirect(loginSupplierUrl(req, path))
    if (role !== "SUPPLIER") {
      const u = new URL(req.url)
      u.pathname = role === "AFFILIATE" ? AFFILIATE_CATALOG_PATH : "/login"
      u.search = ""
      return NextResponse.redirect(u)
    }
  }

  if (isAffiliateArea) {
    if (!loggedIn) return NextResponse.redirect(loginAffiliateUrl(req, path))
    if (role !== "AFFILIATE") {
      const u = new URL(req.url)
      u.pathname = role === "SUPPLIER" ? "/dashboard/supplier" : "/login"
      u.search = ""
      return NextResponse.redirect(u)
    }
  }

  const isMarketplaceBuyerAccount =
    pathname === "/marketplace/account" || pathname.startsWith("/marketplace/account/")
  if (isMarketplaceBuyerAccount) {
    if (!loggedIn) {
      const u = new URL("/login", req.url)
      u.searchParams.set("callbackUrl", path)
      return NextResponse.redirect(u)
    }
    if (role === "AFFILIATE" || role === "SUPPLIER") {
      const u = new URL(req.url)
      u.pathname = role === "SUPPLIER" ? "/dashboard/supplier" : AFFILIATE_CATALOG_PATH
      u.search = ""
      return NextResponse.redirect(u)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/",
    "/auth/signin",
    "/auth/signin/:path*",
    "/shop",
    "/shop/:path*",
    "/shops",
    "/shops/:path*",
    "/marketplace",
    "/marketplace/:path*",
    "/store",
    "/store/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/affiliate/:path*",
  ],
}
