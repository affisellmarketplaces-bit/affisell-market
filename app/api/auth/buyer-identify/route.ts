import { NextResponse } from "next/server"

import { identifyBuyerForCheckout } from "@/lib/buyer-identify"
import { createBuyerCheckoutMagicToken } from "@/lib/buyer-checkout-magic"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
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
      ? await identifyBuyerForCheckout({ channel: "email", email: typeof body.email === "string" ? body.email : "" })
      : await identifyBuyerForCheckout({ channel: "phone", phone: typeof body.phone === "string" ? body.phone : "" })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const checkoutMagic = createBuyerCheckoutMagicToken(result.userId)

  return NextResponse.json({
    ok: true,
    isNew: result.isNew,
    displayLabel: result.displayLabel,
    checkoutMagic,
  })
}
