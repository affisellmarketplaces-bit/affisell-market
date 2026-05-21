import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { inngest } from "@/inngest/client"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  stripeSessionId: z.string().min(1).optional(),
  batchId: z.string().min(1).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || (role !== "ADMIN" && role !== "SUPPLIER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  let stripeSessionId = parsed.data.stripeSessionId
  if (!stripeSessionId && parsed.data.batchId) {
    const batch = await prisma.autoFulfillmentBatch.findUnique({
      where: { id: parsed.data.batchId },
      select: { stripeSessionId: true },
    })
    stripeSessionId = batch?.stripeSessionId
  }
  if (!stripeSessionId) {
    return NextResponse.json({ error: "stripeSessionId required" }, { status: 400 })
  }

  await inngest.send({
    name: "auto-order/batch.fulfill",
    data: { stripeSessionId, batchId: parsed.data.batchId ?? null },
    id: `auto-order-retry-${stripeSessionId}-${Date.now()}`,
  })

  return NextResponse.json({ ok: true, stripeSessionId })
}
