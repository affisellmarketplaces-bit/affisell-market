import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import {
  adminVariantEditsBodySchema,
  buildAdminVariantEditPlan,
} from "@/lib/admin/products/apply-variant-edits"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * PATCH — edit AutoBuy / admin product variants (label, price, stock, photo).
 * Idempotent: replaying the same payload is a no-op.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id: productId } = await ctx.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = adminVariantEditsBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      colors: true,
      colorImages: true,
      images: true,
      productVariants: {
        select: {
          id: true,
          color: true,
          size: true,
          wholesalePriceCents: true,
          supplierPrice: true,
          publicPrice: true,
          stock: true,
          customData: true,
        },
      },
    },
  })

  if (!product) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const plan = buildAdminVariantEditPlan({
    existing: product.productVariants,
    edits: parsed.data.variants,
    colorImagesJson: product.colorImages,
    galleryImages: product.images ?? [],
  })

  if (!plan.ok) {
    return NextResponse.json({ error: plan.error }, { status: 400 })
  }

  if (!plan.changed) {
    console.log("[admin/products/variants]", { productId, result: "noop" })
    return NextResponse.json({ ok: true, changed: false, updated: 0 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const u of plan.updates) {
        await tx.productVariant.update({
          where: { id: u.id },
          data: u.data,
        })
      }
      await tx.product.update({
        where: { id: productId },
        data: {
          colors: plan.colors,
          colorImages: plan.colorImages as unknown as Prisma.InputJsonValue,
          images: plan.galleryImages,
          hasVariants: product.productVariants.length > 1 || plan.colors.length > 1,
        },
      })
    })
  } catch (e) {
    console.error("[admin/products/variants]", e)
    const message = e instanceof Error ? e.message : "update_failed"
    if (/Unique constraint/i.test(message)) {
      return NextResponse.json({ error: "duplicate_color_size" }, { status: 409 })
    }
    return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }

  console.log("[admin/products/variants]", {
    productId,
    result: "updated",
    updated: plan.updates.length,
    imageColors: plan.colorImages.filter((c) => c.image).length,
  })

  return NextResponse.json({
    ok: true,
    changed: true,
    updated: plan.updates.length,
  })
}
