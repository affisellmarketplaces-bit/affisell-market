import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { createAeCaptureSession } from "@/lib/fulfillment/ae-capture-session"
import { createAeCaptureToken } from "@/lib/fulfillment/ae-capture-token"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id: productId } = await ctx.params
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 })
  }

  const sessionId = await createAeCaptureSession(productId)
  const captureToken = createAeCaptureToken(sessionId, productId)
  console.log("[admin-ae-capture-session]", { productId, sessionId })

  return NextResponse.json({ ok: true, sessionId, captureToken, expiresInSec: 900 })
}
