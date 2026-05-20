import createIntlMiddleware from "next-intl/middleware"
import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

import { routing } from "@/i18n/routing"
import {
  AFFILIATE_CATALOG_PATH,
  isMarketplaceListingPath,
  resolveLegacyMarketplaceIndexPath,
} from "@/lib/affiliate-routes"
import { LOCALE_COOKIE, localeCookieMaxAgeSec, resolveAppLocale } from "@/lib/i18n-locale"
import { localeFromPathname, pathnameWithoutLocale } from "@/lib/locale-path"

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
const FORCED_CUSTOMER_HEADER = "x-affisell-view-role"
const intlMiddleware = createIntlMiddleware(routing)

/** Never run next-intl redirects on these — we serve them via `app/page` + `app/[locale]/page`. */
const HOME_PATHS = new Set(["/", "/fr", "/en"])

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

function legacyAuthRedirect(req: NextRequest, pathname: string): NextResponse | null {
  const { searchParams } = req.nextUrl
  const callback = searchParams.get("callbackUrl")

  if (pathname === "/auth/signin/affiliate") {
    return NextResponse.redirect(loginAffiliateUrl(req, callback ?? AFFILIATE_CATALOG_PATH))
  }
  if (pathname === "/auth/signin/supplier") {
    return NextResponse.redirect(loginSupplierUrl(req, callback ?? "/dashboard/supplier"))
  }
  if (pathname !== "/auth/signin") return null

  const role = searchParams.get("role")?.trim().toLowerCase()
  if (role === "affiliate" || role === "creator") {
    return NextResponse.redirect(loginAffiliateUrl(req, callback ?? AFFILIATE_CATALOG_PATH))
  }
  if (role === "supplier" || role === "partner") {
    return NextResponse.redirect(loginSupplierUrl(req, callback ?? "/dashboard/supplier"))
  }
  const u = new URL("/login", req.url)
  if (callback) u.searchParams.set("callbackUrl", callback)
  return NextResponse.redirect(u)
}

function nextWithPathname(req: NextRequest, extraHeaders?: Record<string, string>): NextResponse {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-affisell-pathname", req.nextUrl.pathname)
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    requestHeaders.set(key, value)
  }
  return NextResponse.next({ request: { headers: requestHeaders } })
}

function withForcedCustomerRole(req: NextRequest): NextResponse {
  return nextWithPathname(req, { [FORCED_CUSTOMER_HEADER]: "customer" })
}

function syncLocaleCookies(res: NextResponse, locale: string) {
  const resolved = resolveAppLocale(locale)
  res.cookies.set(LOCALE_COOKIE, resolved, {
    path: "/",
    maxAge: localeCookieMaxAgeSec(),
    sameSite: "lax",
  })
  res.cookies.delete("NEXT_LOCALE")
}

/** Home routes: no next-intl middleware (prevents `/` ↔ `/fr` redirect loops). */
function handleHomePath(req: NextRequest): NextResponse {
  const pathname = req.nextUrl.pathname

  if (pathname === "/en") {
    const u = req.nextUrl.clone()
    u.pathname = "/"
    const res = NextResponse.redirect(u, 308)
    syncLocaleCookies(res, "en")
    return res
  }

  const res = nextWithPathname(req)
  const urlLocale = localeFromPathname(pathname)
  const cookieLocale =
    req.cookies.get(LOCALE_COOKIE)?.value ?? req.cookies.get("NEXT_LOCALE")?.value
  syncLocaleCookies(
    res,
    urlLocale ?? (pathname === "/fr" ? "fr" : resolveAppLocale(cookieLocale ?? routing.defaultLocale))
  )
  return res
}

function isRedirectLoop(source: string, location: string): boolean {
  try {
    const targetPath = new URL(location, "http://localhost").pathname
    return (
      (source === "/" && (targetPath === "/fr" || targetPath === "/en")) ||
      (source === "/fr" && targetPath === "/") ||
      (source === "/en" && targetPath === "/")
    )
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  if (HOME_PATHS.has(pathname)) {
    return handleHomePath(req)
  }

  const bare = pathnameWithoutLocale(pathname)

  const legacy = legacyAuthRedirect(req, bare)
  if (legacy) return legacy

  if (bare === "/shop") {
    const u = req.nextUrl.clone()
    u.pathname = "/shops"
    return NextResponse.redirect(u, 308)
  }

  if (bare.startsWith("/shop/")) {
    const rest = bare.slice("/shop/".length)
    const u = req.nextUrl.clone()
    u.pathname = rest ? `/shops/${rest}` : "/shops"
    return NextResponse.redirect(u, 308)
  }

  if (bare.startsWith("/store/") && !bare.startsWith("/store/supplier/")) {
    const slug = bare.slice("/store/".length).split("/")[0]
    if (slug) {
      const u = req.nextUrl.clone()
      u.pathname = `/shops/${slug}`
      return NextResponse.redirect(u, 308)
    }
  }

  if (bare === "/shops" || bare.startsWith("/shops/")) {
    return withForcedCustomerRole(req)
  }

  if (secret) {
    const path = bare + (req.nextUrl.search || "")
    const token = await getToken({
      req,
      secret,
      secureCookie: secureSessionCookieForRequest(req),
    })
    const role = typeof token?.role === "string" ? token.role : undefined
    const loggedIn = Boolean(token?.sub)

    const isHome = bare === "/"
    if (isHome && role === "AFFILIATE") {
      return NextResponse.redirect(new URL("/dashboard/affiliate", req.url))
    }
    if (isHome && role === "SUPPLIER") {
      return NextResponse.redirect(new URL("/dashboard/supplier", req.url))
    }

    if (bare === "/marketplace") {
      const u = req.nextUrl.clone()
      u.pathname = resolveLegacyMarketplaceIndexPath(role)
      u.search = ""
      return NextResponse.redirect(u, 308)
    }

    if (isMarketplaceListingPath(bare)) {
      return withForcedCustomerRole(req)
    }

    const isSupplierArea = bare === "/dashboard/supplier" || bare.startsWith("/dashboard/supplier/")
    const isAffiliateArea =
      bare === "/dashboard/affiliate" ||
      bare.startsWith("/dashboard/affiliate/") ||
      bare.startsWith("/affiliate/")

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
      bare === "/marketplace/account" || bare.startsWith("/marketplace/account/")
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
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-affisell-pathname", pathname)
  const intlResponse = intlMiddleware(
    new NextRequest(req.url, { headers: requestHeaders })
  )

  const location = intlResponse.headers.get("location")
  if (location && isRedirectLoop(pathname, location)) {
    const res = nextWithPathname(req)
    const urlLocale = localeFromPathname(pathname)
    syncLocaleCookies(res, urlLocale ?? routing.defaultLocale)
    return res
  }

  const urlLocale = localeFromPathname(pathname)
  if (urlLocale) {
    syncLocaleCookies(intlResponse, urlLocale)
  } else if (!location) {
    const cookieLocale =
      req.cookies.get(LOCALE_COOKIE)?.value ?? req.cookies.get("NEXT_LOCALE")?.value
    syncLocaleCookies(intlResponse, cookieLocale ?? routing.defaultLocale)
  }

  return intlResponse
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
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
    "/creators",
    "/partners",
  ],
}
