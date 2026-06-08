import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { checkInBookingPassForSupplier } from "@/lib/booking/check-in"

export const dynamic = "force-dynamic"

const bodySchema = z
  .object({
    token: z.string().min(8).max(512).optional(),
    orderId: z.string().min(1).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.token?.trim() || v.orderId), { message: "token_or_order_required" })

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await checkInBookingPassForSupplier({
    supplierId: session.user.id,
    tokenInput: parsed.data.token,
    orderId: parsed.data.orderId,
  })

  if (!result.ok) {
    const status =
      result.error === "forbidden"
        ? 403
        : result.error === "not_found" || result.error === "invalid_token"
          ? 404
          : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  if (parsed.data.orderId && parsed.data.orderId !== result.orderId) {
    return NextResponse.json({ error: "order_mismatch" }, { status: 400 })
  }

  return NextResponse.json(result)
}
