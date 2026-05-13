import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

function loginUrl(req: NextRequest, pathWithSearch: string) {
  const u = new URL("/login", req.url)
  u.searchParams.set("callbackUrl", pathWithSearch)
  return u
}

export async function middleware(req: NextRequest) {
  if (!secret) return NextResponse.next()

  const path = req.nextUrl.pathname + req.nextUrl.search
  const pathname = req.nextUrl.pathname

  const token = await getToken({ req, secret })
  const role = typeof token?.role === "string" ? token.role : undefined
  const loggedIn = Boolean(token?.sub)

  const isSupplierArea = pathname === "/dashboard/supplier" || pathname.startsWith("/dashboard/supplier/")
  const isAffiliateArea =
    pathname === "/dashboard/affiliate" ||
    pathname.startsWith("/dashboard/affiliate/") ||
    pathname.startsWith("/affiliate/")

  if (isSupplierArea) {
    if (!loggedIn) return NextResponse.redirect(loginUrl(req, path))
    if (role !== "SUPPLIER") {
      const u = new URL(req.url)
      u.pathname = role === "AFFILIATE" ? "/dashboard/affiliate" : "/marketplace"
      u.search = ""
      return NextResponse.redirect(u)
    }
  }

  if (isAffiliateArea) {
    if (!loggedIn) return NextResponse.redirect(loginUrl(req, path))
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
  matcher: ["/dashboard/supplier/:path*", "/dashboard/affiliate/:path*", "/affiliate/:path*"],
}
