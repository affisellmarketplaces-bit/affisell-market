import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

const FORCED_CUSTOMER_HEADER = "x-affisell-view-role"

/** Match Auth.js session cookie name (`__Secure-…` only when the request is HTTPS, e.g. Vercel). */
function secureSessionCookieForRequest(req: NextRequest): boolean {
  return req.nextUrl.protocol === "https:"
}

function signInAffiliateUrl(req: NextRequest, pathWithSearch: string) {
  const u = new URL("/auth/signin/affiliate", req.url)
  u.searchParams.set("callbackUrl", pathWithSearch)
  return u
}

function signInSupplierUrl(req: NextRequest, pathWithSearch: string) {
  const u = new URL("/auth/signin/supplier", req.url)
  u.searchParams.set("callbackUrl", pathWithSearch)
  return u
}

/** Legacy `/auth/signin?role=…` → clean portal routes. */
function legacySignInRedirect(req: NextRequest): NextResponse | null {
  if (req.nextUrl.pathname !== "/auth/signin") return null
  const role = req.nextUrl.searchParams.get("role")?.trim().toLowerCase()
  const callback = req.nextUrl.searchParams.get("callbackUrl")
  if (role === "affiliate") {
    const u = signInAffiliateUrl(req, callback ?? "/marketplace")
    return NextResponse.redirect(u)
  }
  if (role === "supplier") {
    const u = signInSupplierUrl(req, callback ?? "/dashboard/supplier")
    return NextResponse.redirect(u)
  }
  return null
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

  const legacy = legacySignInRedirect(req)
  if (legacy) return legacy

  if (pathname === "/login") {
    const u = req.nextUrl.clone()
    u.pathname = "/auth/signin"
    return NextResponse.redirect(u)
  }

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

  const isMarketplace =
    pathname === "/marketplace" || pathname.startsWith("/marketplace/")
  if (isMarketplace && pathname !== "/marketplace/account" && !pathname.startsWith("/marketplace/account/")) {
    if (!loggedIn || role !== "AFFILIATE") {
      return NextResponse.redirect(signInAffiliateUrl(req, path))
    }
  }

  const isSupplierArea = pathname === "/dashboard/supplier" || pathname.startsWith("/dashboard/supplier/")
  const isAffiliateArea =
    pathname === "/dashboard/affiliate" ||
    pathname.startsWith("/dashboard/affiliate/") ||
    pathname.startsWith("/affiliate/")

  if (isSupplierArea) {
    if (!loggedIn) return NextResponse.redirect(signInSupplierUrl(req, path))
    if (role !== "SUPPLIER") {
      const u = new URL(req.url)
      u.pathname = role === "AFFILIATE" ? "/dashboard/affiliate" : "/marketplace"
      u.search = ""
      return NextResponse.redirect(u)
    }
  }

  if (isAffiliateArea) {
    if (!loggedIn) return NextResponse.redirect(signInAffiliateUrl(req, path))
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
    if (!loggedIn) {
      const u = new URL("/auth/signin", req.url)
      u.searchParams.set("callbackUrl", path)
      return NextResponse.redirect(u)
    }
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
    "/auth/signin",
    "/shop",
    "/shop/:path*",
    "/shops",
    "/shops/:path*",
    "/marketplace",
    "/marketplace/:path*",
    "/dashboard/supplier",
    "/dashboard/supplier/:path*",
    "/dashboard/affiliate",
    "/dashboard/affiliate/:path*",
    "/affiliate/:path*",
    "/marketplace/account",
    "/marketplace/account/:path*",
  ],
}
