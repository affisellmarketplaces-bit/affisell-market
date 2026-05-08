import { NextResponse } from "next/server"

import { auth } from "@/auth"

export default auth((req) => {
  const res = NextResponse.next()
  const isLoggedIn = !!req.auth

  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/auth") ||
    req.nextUrl.pathname.startsWith("/register")

  const isSupplierPage = req.nextUrl.pathname.startsWith("/supplier")

  // Rule 1: Not logged in + trying to access supplier = redirect to login
  if (!isLoggedIn && isSupplierPage) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Rule 2: Logged in + on login/auth pages = redirect to supplier dashboard
  if (isLoggedIn && isAuthPage) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = "/supplier/dashboard"
    return NextResponse.redirect(redirectUrl)
  }

  return res
})

export const config = {
  matcher: ["/supplier/:path*", "/login", "/auth/:path*"],
}
