import { auth } from "@/auth"

export const runtime = "nodejs"

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  const isPublicRoute = ["/", "/login", "/api/auth"].some((route) =>
    nextUrl.pathname.startsWith(route)
  )

  if (!isLoggedIn && !isPublicRoute) {
    return Response.redirect(new URL("/login", nextUrl))
  }
  return undefined
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
