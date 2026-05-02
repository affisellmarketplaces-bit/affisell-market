import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { OAUTH_SIGNUP_INTENT_COOKIE } from "@/lib/oauth-cookies"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const ALLOWED = new Set(["CUSTOMER", "AFFILIATE", "SUPPLIER"])

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { intent?: string }
    const intent = typeof body.intent === "string" && ALLOWED.has(body.intent) ? body.intent : "CUSTOMER"
    const jar = await cookies()
    jar.set(OAUTH_SIGNUP_INTENT_COOKIE, intent, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    })
    return NextResponse.json({ ok: true, intent })
  } catch {
    return NextResponse.json({ error: "Failed to set intent" }, { status: 500 })
  }
}
