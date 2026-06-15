import { NextResponse } from "next/server"
import { z } from "zod"

import {
  enableCheckoutCountryRollout,
  notifyCheckoutCountryWaitlist,
} from "@/lib/admin/checkout-country-rollout-actions"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  countryIso2: z.string().trim().min(2).max(2),
})

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 })
  }

  const result = await enableCheckoutCountryRollout(parsed.data.countryIso2)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json(result)
}
