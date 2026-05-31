import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

const bodySchema = z.object({
  enabled: z.boolean(),
})

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id: productId } = await ctx.params
  const { enabled } = bodySchema.parse(await req.json())

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, supplierLink: { select: { id: true } } },
  })

  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 })
  }

  await prisma.product.update({
    where: { id: productId },
    data: { autoFulfill: enabled },
  })

  if (product.supplierLink) {
    await prisma.supplierLink.update({
      where: { id: product.supplierLink.id },
      data: { autoBuyEnabled: enabled, isActive: true },
    })
  }

  console.log("[admin-auto-buy-toggle]", { productId, enabled, hasLink: Boolean(product.supplierLink) })

  return NextResponse.json({
    ok: true,
    enabled,
    supplierLinkUpdated: Boolean(product.supplierLink),
  })
}
