import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Journalisation légère du consentement cookies (pas de PII obligatoire).
 * Idempotent : safe si rejoué.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      choice?: string
      analytics?: boolean
      marketing?: boolean
    } | null

    const choice = body?.choice === "accepted" || body?.choice === "refused" ? body.choice : "unknown"

    console.log("[legal-consent]", {
      choice,
      analytics: Boolean(body?.analytics),
      marketing: Boolean(body?.marketing),
      result: "ok",
      at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    console.log("[legal-consent]", { result: "error", error: message })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
