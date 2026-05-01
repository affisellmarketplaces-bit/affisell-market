import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import createMiddleware from "next-intl/middleware"

import { auth } from "@/auth"
import { routing } from "@/i18n/routing"

const intlMiddleware = createMiddleware(routing)

export default auth((req) => {
  const p = req.nextUrl.pathname

  if (
    p.startsWith("/api") ||
    p.startsWith("/_next") ||
    p.startsWith("/_vercel") ||
    /\.[^/]+$/.test(p)
  ) {
    return NextResponse.next()
  }

  const segments = p.split("/").filter(Boolean)
  const first = segments[0]
  const hasLocale = Boolean(
    first && (routing.locales as readonly string[]).includes(first)
  )

  if (!hasLocale) {
    return intlMiddleware(req as unknown as NextRequest)
  }

  const locale = first as string
  const subpath = "/" + segments.slice(1).join("/") || "/"

  if (subpath.startsWith("/dashboard") && !req.auth) {
    const loginUrl = new URL(`/${locale}/login`, req.url)
    loginUrl.searchParams.set("callbackUrl", p)
    return NextResponse.redirect(loginUrl)
  }

  return intlMiddleware(req as unknown as NextRequest)
})

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
