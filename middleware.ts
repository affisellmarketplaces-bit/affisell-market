import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

/** Match Auth.js session cookie name (`__Secure-…` only when the request is HTTPS, e.g. Vercel). */
function useSecureSessionCookie(req: NextRequest): boolean {
  return req.nextUrl.protocol === "https:"
}

/** Send unauthenticated users straight to sign-in (avoids an extra `/login` hop that could render blank). */
function signInRedirectUrl(req: NextRequest, pathWithSearch: string) {
  const u = new URL("/auth/signin", req.url)
  u.searchParams.set("callbackUrl", pathWithSearch)
  return u
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  /** One server redirect (no blank client page). Preserves `?callbackUrl=`. */
  if (pathname === "/login") {
    const u = req.nextUrl.clone()
    u.pathname = "/auth/signin"
    return NextResponse.redirect(u)
  }

  if (!secret) return NextResponse.next()

  const path = req.nextUrl.pathname + req.nextUrl.search

  const token = await getToken({
    req,
    secret,
    secureCookie: useSecureSessionCookie(req),
  })
  const role = typeof token?.role === "string" ? token.role : undefined
  const loggedIn = Boolean(token?.sub)

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

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/supplier",
    "/dashboard/supplier/:path*",
    "/dashboard/affiliate",
    "/dashboard/affiliate/:path*",
    "/affiliate/:path*",
  ],
}
