import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { joinBookingWaitlist } from "@/lib/booking/waitlist"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    slotId?: string
    productId?: string
    email?: string
    phone?: string
    qty?: number
  }

  const slotId = typeof body.slotId === "string" ? body.slotId.trim() : ""
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (!slotId || !productId) {
    return NextResponse.json({ error: "slotId and productId required" }, { status: 400 })
  }

  const session = await auth()
  const sessionEmail = session?.user?.email?.trim() ?? ""
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : sessionEmail

  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 })
  }

  const result = await joinBookingWaitlist({
    slotId,
    productId,
    email,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    userId: session?.user?.id ?? null,
    qty: body.qty,
  })

  if (!result.ok) {
    const status =
      result.error === "slot_available"
        ? 409
        : result.error === "slot_not_found" || result.error === "slot_past"
          ? 404
          : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, created: result.created })
}
