import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.union([
  z.object({ scope: z.literal("all"), enabled: z.boolean() }),
  z.object({ scope: z.literal("product"), productId: z.string().min(1), enabled: z.boolean() }),
])

/**
 * Interrupteur auto-buy fournisseur (Supply Hub → Auto-buy Pilot).
 * - scope "all" : tous les SKU liés du fournisseur connecté.
 * - scope "product" : un SKU (ownership vérifié).
 * Idempotent : rejouer la même requête produit le même état.
 */
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const supplierId = session.user.id

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const body = parsed.data
  const { enabled } = body

  if (body.scope === "product") {
    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      select: { id: true, supplierId: true, supplierLink: { select: { id: true } } },
    })
    if (!product || product.supplierId !== supplierId) {
      return NextResponse.json({ error: "product_not_found" }, { status: 404 })
    }
    if (!product.supplierLink) {
      return NextResponse.json({ error: "no_supplier_link" }, { status: 409 })
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { autoBuyEnabled: enabled, autoFulfill: enabled },
      }),
      prisma.supplierLink.update({
        where: { id: product.supplierLink.id },
        data: { autoBuyEnabled: enabled, ...(enabled ? { isActive: true } : {}) },
      }),
    ])

    console.log("[auto-buy-pilot]", {
      supplierId,
      scope: "product",
      productId: product.id,
      enabled,
      result: "toggled",
    })
    return NextResponse.json({ ok: true, scope: "product", productId: product.id, enabled })
  }

  const [productsRes, linksRes] = await prisma.$transaction([
    prisma.product.updateMany({
      where: { supplierId, supplierLink: { isNot: null } },
      data: { autoBuyEnabled: enabled, autoFulfill: enabled },
    }),
    prisma.supplierLink.updateMany({
      where: { product: { supplierId } },
      data: { autoBuyEnabled: enabled, ...(enabled ? { isActive: true } : {}) },
    }),
  ])

  console.log("[auto-buy-pilot]", {
    supplierId,
    scope: "all",
    enabled,
    products: productsRes.count,
    links: linksRes.count,
    result: "toggled",
  })
  return NextResponse.json({ ok: true, scope: "all", enabled, updated: linksRes.count })
}
