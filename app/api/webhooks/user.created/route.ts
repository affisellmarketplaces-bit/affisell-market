import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { sendWelcomeLegalEmail } from "@/lib/emails/send-welcome-legal-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UserCreatedPayload = {
  userId?: string
}

export async function POST(req: Request) {
  const authError = authorizeCronRequest(req)
  if (authError) return authError

  let body: UserCreatedPayload
  try {
    body = (await req.json()) as UserCreatedPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const userId = body.userId?.trim()
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const result = await sendWelcomeLegalEmail(userId)

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate ?? false,
      resendId: result.resendId,
    })
  }

  if (result.skipped) {
    return NextResponse.json({ ok: false, skipped: true, error: result.error }, { status: 200 })
  }

  const status =
    result.error === "user_not_found"
      ? 404
      : result.error === "missing_legal_versions"
        ? 503
        : 502

  return NextResponse.json({ ok: false, error: result.error }, { status })
}
