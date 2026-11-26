import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { identifyAndEstablishBuyerSession } from "@/lib/buyer-identify-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const limited = rateLimitResponse(rateLimitClientKey(req), {
      prefix: "buyer-identify",
      limit: 30,
      windowMs: 60_000,
    })
    if (limited) return limited

    const body = (await req.json().catch(() => ({}))) as {
      channel?: string
      email?: string
      phone?: string
    }

    const channel = body.channel === "phone" ? "phone" : body.channel === "email" ? "email" : null
    if (!channel) {
      return NextResponse.json({ error: "Choisissez e-mail ou téléphone." }, { status: 400 })
    }

    const result =
      channel === "email"
        ? await identifyAndEstablishBuyerSession({
            channel: "email",
            email: typeof body.email === "string" ? body.email : "",
          })
        : await identifyAndEstablishBuyerSession({
            channel: "phone",
            phone: typeof body.phone === "string" ? body.phone : "",
          })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    if (!result.sessionEstablished) {
      // Existing account with an owner or history: a typed identifier is not proof, so no session and no name.
      return NextResponse.json({
        ok: true,
        isNew: false,
        sessionEstablished: false,
        requiresSignIn: true,
      })
    }

    return NextResponse.json({
      ok: true,
      isNew: result.isNew,
      displayLabel: result.displayLabel,
      sessionEstablished: true,
    })
  } catch (error) {
    console.error("[buyer-identify-route]", {
      result: "error",
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "buyer_identify_failed" }, { status: 500 })
  }
}
