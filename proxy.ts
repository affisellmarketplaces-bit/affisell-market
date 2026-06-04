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
import { loginAffiliatePath, loginSupplierPath, resolvePostLoginRedirect } from "@/lib/login-redirect"
import { tryCustomDomainMiddleware } from "@/lib/middleware-custom-domain"
import {
  isMerchantTermsExemptPath,
  isMerchantTermsGatedPath,
  isReacceptTermsPath,
  merchantTermsGateOk,
  reacceptTermsUrl,
} from "@/lib/middleware-terms-gate"
import { isStaticAppPathname, staticAppRewriteTarget } from "@/lib/reserved-locale-segments"

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

function loginAdminUrl(req: NextRequest, pathWithSearch: string) {
  const u = new URL("/login/admin", req.url)
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
  const pathname = req.nextUrl.pathname
  requestHeaders.set("x-affisell-pathname", pathname)
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    requestHeaders.set(key, value)
  }
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  const urlLocale = localeFromPathname(pathname)
  const cookieLocale =
    req.cookies.get(LOCALE_COOKIE)?.value ?? req.cookies.get("NEXT_LOCALE")?.value
  syncLocaleCookies(res, urlLocale ?? resolveAppLocale(cookieLocale ?? routing.defaultLocale))
  return res
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
async function handleHomePath(req: NextRequest): Promise<NextResponse> {
  const pathname = req.nextUrl.pathname

  if (secret) {
    const token = await getToken({
      req,
      secret,
      secureCookie: secureSessionCookieForRequest(req),
    })
    const role = typeof token?.role === "string" ? token.role : undefined
    if (role === "AFFILIATE") {
      return NextResponse.redirect(new URL("/dashboard/affiliate", req.url))
    }
    if (role === "SUPPLIER") {
      return NextResponse.redirect(new URL("/dashboard/supplier", req.url))
    }
  }

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

function rewriteStaticAppPath(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname
  const bare = staticAppRewriteTarget(pathname)
  if (!bare) return null

  const urlLocale = localeFromPathname(pathname)
  if (!urlLocale) return null

  const rewriteUrl = req.nextUrl.clone()
  rewriteUrl.pathname = bare

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-affisell-pathname", pathname)
  const res = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
  syncLocaleCookies(res, urlLocale)
  return res
}

/** Next.js 16+ proxy (ex-middleware). */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  const customDomainResponse = await tryCustomDomainMiddleware(req)
  if (customDomainResponse) return customDomainResponse

  if (HOME_PATHS.has(pathname)) {
    return handleHomePath(req)
  }

  const bareEarly = pathnameWithoutLocale(pathname)
  if (bareEarly === "/home") {
    const u = req.nextUrl.clone()
    const urlLocale = localeFromPathname(pathname)
    u.pathname = urlLocale ? `/${urlLocale}` : "/"
    return NextResponse.redirect(u, 308)
  }

  if (isStaticAppPathname(pathname)) {
    const rewritten = rewriteStaticAppPath(req)
    if (rewritten) return rewritten
    return nextWithPathname(req)
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

    const isLoginPath = bare === "/login" || bare.startsWith("/login/")

    if (isLoginPath && loggedIn && role) {
      const callbackRaw = req.nextUrl.searchParams.get("callbackUrl")
      const dest = new URL(resolvePostLoginRedirect(role, callbackRaw), req.url)
      return NextResponse.redirect(dest)
    }

    if (isSupplierArea) {
      if (!loggedIn) return NextResponse.redirect(loginSupplierUrl(req, path))
      if (role !== "SUPPLIER") {
        const u = new URL(req.url)
        if (role === "AFFILIATE") {
          u.pathname = AFFILIATE_CATALOG_PATH
        } else if (role === "CUSTOMER") {
          u.pathname = "/shops"
        } else {
          return NextResponse.redirect(new URL(loginSupplierPath(path), req.url))
        }
        u.search = ""
        return NextResponse.redirect(u)
      }
    }

    if (isAffiliateArea) {
      if (!loggedIn) return NextResponse.redirect(loginAffiliateUrl(req, path))
      if (role !== "AFFILIATE") {
        const u = new URL(req.url)
        if (role === "SUPPLIER") {
          u.pathname = "/dashboard/supplier"
          u.search = ""
          return NextResponse.redirect(u)
        }
        if (role === "CUSTOMER") {
          u.pathname = "/shops"
          u.search = ""
          return NextResponse.redirect(u)
        }
        return NextResponse.redirect(new URL(loginAffiliatePath(path), req.url))
      }
    }

    if (
      loggedIn &&
      (role === "SUPPLIER" || role === "AFFILIATE") &&
      isMerchantTermsGatedPath(bare) &&
      !isMerchantTermsExemptPath(bare) &&
      !isReacceptTermsPath(bare) &&
      !merchantTermsGateOk(req, role, token)
    ) {
      return NextResponse.redirect(reacceptTermsUrl(req, path))
    }

    const isAdminArea = bare === "/admin" || bare.startsWith("/admin/")
    if (isAdminArea) {
      if (!loggedIn) return NextResponse.redirect(loginAdminUrl(req, path))
      if (role !== "ADMIN") {
        const u = new URL(req.url)
        if (role === "SUPPLIER") {
          u.pathname = "/dashboard/supplier"
        } else if (role === "AFFILIATE") {
          u.pathname = AFFILIATE_CATALOG_PATH
        } else {
          u.pathname = "/shops"
        }
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

/** @deprecated Alias — use `proxy`. */
export const middleware = proxy

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
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/affiliate/:path*",
    "/agent",
    "/creators",
    "/partners",
    "/demo",
    "/demo/:path*",
  ],
}
