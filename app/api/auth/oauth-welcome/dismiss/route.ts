import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { OAUTH_WELCOME_COOKIE } from "@/lib/oauth-cookies"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const jar = await cookies()
    jar.delete(OAUTH_WELCOME_COOKIE)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
