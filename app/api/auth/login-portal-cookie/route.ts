import { NextResponse } from "next/server"

import { AUTH_LOGIN_CALLBACK_COOKIE, inferLoginPortal } from "@/lib/auth-login-portal"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COOKIE_SAFE = process.env.NODE_ENV === "production"

/**
 * Stores the post-login target so OAuth `signIn` can reject supplier↔affiliate mismatches
 * (credentials already use `callbackUrl` in `authorize`).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { callbackUrl?: unknown }
    const raw = typeof body.callbackUrl === "string" ? body.callbackUrl.trim() : ""
    if (!raw || !inferLoginPortal(raw)) {
      return NextResponse.json({ ok: false, error: "No merchant portal in callbackUrl" }, { status: 400 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(AUTH_LOGIN_CALLBACK_COOKIE, encodeURIComponent(raw), {
      httpOnly: true,
      sameSite: "lax",
      secure: COOKIE_SAFE,
      path: "/",
      maxAge: 600,
    })
    return res
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
