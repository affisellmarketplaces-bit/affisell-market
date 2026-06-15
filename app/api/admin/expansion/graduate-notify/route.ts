import { NextResponse } from "next/server"
import { z } from "zod"

import { notifyCheckoutCountryGraduatedBuyers } from "@/lib/admin/notify-checkout-country-graduated-buyers"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  countryIso2: z.string().trim().min(2).max(2),
})

/** Admin: send graduation buyer emails for a permanently graduated country (idempotent). */
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

  const result = await notifyCheckoutCountryGraduatedBuyers(parsed.data.countryIso2)
  if (result.skipped) {
    return NextResponse.json({ ok: false, error: "already_sent_or_not_graduated" }, { status: 400 })
  }

  return NextResponse.json({ ok: true, ...result })
}
