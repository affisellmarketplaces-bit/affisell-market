import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { issueEmailVerification } from "@/lib/email-verification.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** A signed-in password account asks for a new verification link (3 per hour). */
export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), {
    prefix: "auth-resend-verification",
    limit: 3,
    windowMs: 60 * 60_000,
  })
  if (limited) return limited

  const result = await issueEmailVerification({ userId })
  if (result.ok) return NextResponse.json({ ok: true, sent: result.sent })
  if (result.reason === "already_verified") return NextResponse.json({ ok: true, alreadyVerified: true })
  if (result.reason === "no_password") return NextResponse.json({ error: "not_applicable" }, { status: 400 })
  return NextResponse.json({ error: "unavailable" }, { status: 503 })
}
