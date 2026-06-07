import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { requestPasswordReset } from "@/lib/password-reset.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), {
    prefix: "auth-forgot-password",
    limit: 5,
    windowMs: 15 * 60_000,
  })
  if (limited) return limited

  try {
    const body = (await req.json()) as { email?: string }
    const email = typeof body.email === "string" ? body.email : ""
    if (!email.trim()) {
      return NextResponse.json({ error: "missing_email" }, { status: 400 })
    }

    await requestPasswordReset(email)

    return NextResponse.json({
      ok: true,
      message:
        "Si un compte existe avec cet e-mail, vous recevrez un lien de réinitialisation sous peu.",
    })
  } catch (e) {
    console.error("[auth-forgot-password]", { result: "error", message: String(e) })
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
