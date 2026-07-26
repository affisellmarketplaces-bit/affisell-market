import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

/**
 * Server-side bridge: forwards Clerk session token to Market Intelli API
 * without exposing it in the browser URL or query string.
 */
export async function GET() {
  const { userId, getToken } = await auth()
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const token = await getToken()
  if (!token) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const apiUrl = process.env.NEXT_PUBLIC_MI_API_URL?.trim().replace(/\/$/, "")
  if (!apiUrl) {
    console.log("[tiktok-oauth-proxy]", { result: "missing_NEXT_PUBLIC_MI_API_URL" })
    return new NextResponse("Market Intelli API URL not configured", { status: 500 })
  }
  if (/localhost|127\.0\.0\.1/i.test(apiUrl) && process.env.NODE_ENV === "production") {
    console.log("[tiktok-oauth-proxy]", { result: "localhost_rejected" })
    return new NextResponse("Market Intelli API URL must be public in production", { status: 500 })
  }

  const res = await fetch(`${apiUrl}/auth/tiktok/start`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "manual",
  })

  const location = res.headers.get("location")
  if (
    location &&
    (res.status === 302 || res.status === 301 || res.status === 307 || res.status === 308)
  ) {
    return NextResponse.redirect(location)
  }

  console.log("[tiktok-oauth-proxy]", { result: "failed", status: res.status, userId })
  return new NextResponse("OAuth start failed", { status: 500 })
}
