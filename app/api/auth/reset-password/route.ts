import { NextResponse } from "next/server"

import { resetPasswordWithToken } from "@/lib/password-reset.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; password?: string }
    const token = typeof body.token === "string" ? body.token : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!token.trim() || !password) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 })
    }

    const result = await resetPasswordWithToken(token, password)
    if (!result.ok) {
      const status = result.error === "password_too_short" ? 400 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[auth-reset-password]", { result: "error", message: String(e) })
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
