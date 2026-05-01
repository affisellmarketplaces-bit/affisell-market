import { NextResponse } from "next/server"

import { auth } from "@/auth"

export default auth((req) => {
  if (req.nextUrl.pathname.startsWith("/dashboard") && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/dashboard/:path*"],
}
