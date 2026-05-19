import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

const FORCED_CUSTOMER_HEADER = "x-affisell-view-role"

/** Match Auth.js session cookie name (`__Secure-…` only when the request is HTTPS, e.g. Vercel). */
function secureSessionCookieForRequest(req: NextRequest): boolean {
  return req.nextUrl.protocol === "https:"
}

/** Send unauthenticated users straight to sign-in (avoids an extra `/login` hop that could render blank). */
function signInRedirectUrl(req: NextRequest, pathWithSearch: string, role?: string) {
  const u = new URL("/auth/signin", req.url)
  u.searchParams.set("callbackUrl", pathWithSearch)
  if (role) u.searchParams.set("role", role)
  return u
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

  /** One server redirect (no blank client page). Preserves `?callbackUrl=`. */
  if (pathname === "/login") {
    const u = req.nextUrl.clone()
    u.pathname = "/auth/signin"
    return NextResponse.redirect(u)
  }

  /** Legacy `/shop/*` → canonical `/shops/*` */
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

  /**
   * Public creator storefront UI: affiliates see the shopper experience here.
   * `?preview=affiliate` (+ logged-in AFFILIATE) restores business card mode on the client only.
   */
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

  /** Affiliate portal home — requires sign-in. */
  if (pathname === "/" && !loggedIn) {
    return NextResponse.redirect(signInRedirectUrl(req, "/", "affiliate"))
  }

  const isSupplierArea = pathname === "/dashboard/supplier" || pathname.startsWith("/dashboard/supplier/")
  const isAffiliateArea =
    pathname === "/dashboard/affiliate" ||
    pathname.startsWith("/dashboard/affiliate/") ||
    pathname.startsWith("/affiliate/")

  if (isSupplierArea) {
    if (!loggedIn) return NextResponse.redirect(signInRedirectUrl(req, path))
    if (role !== "SUPPLIER") {
      const u = new URL(req.url)
      u.pathname = role === "AFFILIATE" ? "/dashboard/affiliate" : "/marketplace"
      u.search = ""
      return NextResponse.redirect(u)
    }
  }

  if (isAffiliateArea) {
    if (!loggedIn) return NextResponse.redirect(signInRedirectUrl(req, path))
    if (role !== "AFFILIATE") {
      const u = new URL(req.url)
      u.pathname = role === "SUPPLIER" ? "/dashboard/supplier" : "/marketplace"
      u.search = ""
      return NextResponse.redirect(u)
    }
  }

  const isMarketplaceBuyerAccount =
    pathname === "/marketplace/account" || pathname.startsWith("/marketplace/account/")
  if (isMarketplaceBuyerAccount) {
    if (!loggedIn) return NextResponse.redirect(signInRedirectUrl(req, path))
    if (role === "AFFILIATE" || role === "SUPPLIER") {
      const u = new URL(req.url)
      u.pathname = role === "SUPPLIER" ? "/dashboard/supplier" : "/dashboard/affiliate"
      u.search = ""
      return NextResponse.redirect(u)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/shop",
    "/shop/:path*",
    "/shops",
    "/shops/:path*",
    "/dashboard/supplier",
    "/dashboard/supplier/:path*",
    "/dashboard/affiliate",
    "/dashboard/affiliate/:path*",
    "/affiliate/:path*",
    "/marketplace/account",
    "/marketplace/account/:path*",
  ],
}
