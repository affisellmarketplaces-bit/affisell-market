import { NextResponse } from "next/server"
import { z } from "zod"

import {
  isAffiliatePayoutSessionError,
  requireAffiliatePayoutSession,
} from "@/lib/payouts/affiliate-payout-session"
import { verifyIbanMod97 } from "@/lib/payouts/iban-verify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const verifyIbanSchema = z.object({
  iban: z.string().min(15),
})

export async function POST(req: Request) {
  const session = await requireAffiliatePayoutSession()
  if (isAffiliatePayoutSessionError(session)) return session

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = verifyIbanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const iban = parsed.data.iban.replace(/\s/g, "").toUpperCase()
  const valid = verifyIbanMod97(iban)

  return NextResponse.json({ valid, bank: "" })
}
