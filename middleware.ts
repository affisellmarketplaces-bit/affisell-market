import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import createMiddleware from "next-intl/middleware"

import { auth } from "@/auth"
import { routing } from "@/i18n/routing"

const intlMiddleware = createMiddleware(routing)

export default auth((req) => {
  const pathname = req.nextUrl.pathname

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_vercel") ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/dashboard") && !req.auth) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  return intlMiddleware(req as unknown as NextRequest)
})

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
