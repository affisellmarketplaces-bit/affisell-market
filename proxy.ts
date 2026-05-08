import { NextResponse } from "next/server"

import { auth } from "@/auth"

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const isPublicRoute = ["/", "/login", "/api/auth"].some(
    (path) => nextUrl.pathname === path || nextUrl.pathname.startsWith("/api/auth")
  )

  if (!isLoggedIn && !isPublicRoute) {
    return Response.redirect(new URL("/login", nextUrl))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
