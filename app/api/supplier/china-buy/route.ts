import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { routeChinaBuy } from "@/lib/china-buying/route-china-buy"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  sourceUrl: z.string().url(),
  agentId: z.string().min(1),
  platform: z.string().optional(),
  productId: z.string().optional(),
  quantity: z.number().int().min(1).max(99).optional(),
})

/** Route a China URL to the selected buying agent (Superbuy, Anovabuy, …). */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const supplierId = session.user.id
  const { sourceUrl, agentId, platform, productId, quantity } = parsed.data

  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { supplierId: true },
    })
    if (!product || product.supplierId !== supplierId) {
      return NextResponse.json({ error: "product_not_found" }, { status: 404 })
    }
  }

  const routed = await routeChinaBuy({
    supplierId,
    sourceUrl,
    agentId,
    platform: platform ?? null,
    productId: productId ?? null,
    quantity,
  })

  if (!routed.ok) {
    return NextResponse.json({ error: routed.error }, { status: 400 })
  }

  if (productId) {
    await prisma.product.update({
      where: { id: productId },
      data: {
        sourceUrl,
        chinaBuyingAgentId: agentId,
        chinaPlatform: platform?.trim() ?? null,
        importSource: platform?.trim() ?? "china",
      },
    })
  }

  return NextResponse.json({
    ok: true,
    logId: routed.logId,
    status: routed.status,
    externalRef: routed.externalRef ?? null,
    redirectUrl: routed.redirectUrl ?? null,
    message: routed.message ?? null,
    idempotent: routed.idempotent ?? false,
  })
}
