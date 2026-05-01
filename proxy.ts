import type { NextFetchEvent, NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"

const nextAuthHandler = auth((req) => {
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

  return NextResponse.next()
})

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return nextAuthHandler(request, event)
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
