import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { isApparelProduct } from "@/lib/try-on/is-apparel-product"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z.object({
  tryOnEnabled: z.boolean(),
  tryOnGarmentUrl: z.string().url().nullable().optional(),
})

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const product = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    select: {
      tryOnEnabled: true,
      tryOnGarmentUrl: true,
      categories: true,
      category: { select: { fullPath: true } },
    },
  })
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    tryOnEnabled: product.tryOnEnabled,
    tryOnGarmentUrl: product.tryOnGarmentUrl,
    apparelEligible: isApparelProduct({
      categoryFullPath: product.category?.fullPath,
      legacyCategories: product.categories,
    }),
  })
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const existing = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    select: {
      categories: true,
      category: { select: { fullPath: true } },
    },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 })
  }

  if (parsed.data.tryOnEnabled) {
    if (
      !isApparelProduct({
        categoryFullPath: existing.category?.fullPath,
        legacyCategories: existing.categories,
      })
    ) {
      return NextResponse.json(
        { error: "Try-on is only available for apparel categories" },
        { status: 400 }
      )
    }
    const url = parsed.data.tryOnGarmentUrl?.trim()
    if (!url) {
      return NextResponse.json(
        { error: "tryOnGarmentUrl (transparent PNG flat-lay) is required when enabling try-on" },
        { status: 400 }
      )
    }
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      tryOnEnabled: parsed.data.tryOnEnabled,
      ...(parsed.data.tryOnGarmentUrl !== undefined
        ? { tryOnGarmentUrl: parsed.data.tryOnGarmentUrl }
        : {}),
    },
    select: { tryOnEnabled: true, tryOnGarmentUrl: true },
  })

  console.log("[try-on]", {
    result: "supplier_settings_updated",
    productId: id,
    tryOnEnabled: updated.tryOnEnabled,
  })

  return NextResponse.json(updated)
}
