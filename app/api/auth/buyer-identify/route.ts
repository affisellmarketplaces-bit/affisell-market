import { NextResponse } from "next/server"

import { identifyAndEstablishBuyerSession } from "@/lib/buyer-identify-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
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
