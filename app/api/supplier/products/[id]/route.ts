import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  findSupplierProductGuardForPut,
  findSupplierProductWithAttributesForOwner,
} from "@/lib/supplier-product-is-draft-fallback"
import { createNewDropCommunityPost } from "@/lib/community-new-drop"
import { parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import { parseCompareAtDraftLax, parseCompareAtStrict } from "@/lib/supplier-product-compare-at"
import { parseDescriptionBullets } from "@/lib/supplier-product-description-bullets"
import { parseProductMarketplaceMeta } from "@/lib/supplier-product-marketplace-meta"
import { parseSupplierProductShippingBody } from "@/lib/supplier-product-shipping"
import { parseSupplierProductImages } from "@/lib/supplier-product-images"
import {
  defaultAffiliateCommissionPct,
  normalizeAffiliateCommissionRatePct,
  parseListingKind,
} from "@/lib/supplier-commission"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function assertOwnProduct(supplierId: string, productId: string) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: { id: true },
  })
  return Boolean(existing)
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const own = await assertOwnProduct(session.user.id, id)
  if (!own) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const p = await findSupplierProductWithAttributesForOwner(id, session.user.id)
  if (!p) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json({
    ...p,
    compareAt: p.compareAt != null ? Number(p.compareAt) : null,
    freeShippingThreshold: p.freeShippingThreshold != null ? Number(p.freeShippingThreshold) : null,
    shippingCost: Number(p.shippingCost),
    listingKind: parseListingKind(p.listingKind),
  })
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const own = await assertOwnProduct(session.user.id, id)
  if (!own) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const rawBody = (await req.json()) as Record<string, unknown>
  const publish = Boolean(rawBody.publish)
  const saveAsDraftReq = Boolean(rawBody.saveAsDraft)

  const existingRow = await findSupplierProductGuardForPut(id)
  if (!existingRow) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  if (!existingRow.isDraft && saveAsDraftReq) {
    return Response.json({ error: "This listing is live—use Publish to update it." }, { status: 400 })
  }

  const body = rawBody as {
    name?: string
    description?: string
    image?: string
    images?: unknown
    price?: number
    compareAt?: number | string | null
    commission?: number
    stock?: number
    categoryId?: string | null
    productAttributes?: Array<{ key?: unknown; label?: unknown; value?: unknown }>
    listingKind?: unknown
  }

  const listingKind = parseListingKind(body.listingKind ?? existingRow.listingKind)
  let priceCents: number
  let compareAt: Prisma.Decimal | null = null
  let rate: number
  let nameResolved: string
  let stock: number
  let draftUpdateOnly = existingRow.isDraft && !publish

  if (draftUpdateOnly) {
    const priceNum = Number(body.price)
    priceCents = Number.isFinite(priceNum) && priceNum >= 0
      ? Math.max(100, Math.round(priceNum * 100))
      : Math.max(100, existingRow.basePriceCents)

    compareAt = parseCompareAtDraftLax(priceCents, body.compareAt ?? null)

    const commRaw = body.commission
    const commFallback = Number.isFinite(Number(commRaw))
      ? Number(commRaw)
      : existingRow.commissionRate
    const normalized = normalizeAffiliateCommissionRatePct(commFallback, listingKind)
    rate = normalized.ok ? normalized.rate : defaultAffiliateCommissionPct()

    const rawName = typeof body.name === "string" ? body.name.trim() : ""
    nameResolved = (rawName || "Untitled draft").slice(0, 500)

    stock = Math.max(
      0,
      Math.round(
        Number.isFinite(Number(body.stock)) ? Number(body.stock) : existingRow.stock
      )
    )
  } else {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) {
      return Response.json({ error: "Missing name" }, { status: 400 })
    }
    nameResolved = name.slice(0, 500)

    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) {
      return Response.json({ error: "Invalid price" }, { status: 400 })
    }
    priceCents = Math.max(100, Math.round(price * 100))

    const strict = parseCompareAtStrict(priceCents, body.compareAt ?? null)
    if (!strict.ok) {
      return Response.json({ error: strict.error }, { status: 400 })
    }
    compareAt = strict.decimal

    const commRaw = body.commission
    const commFallback = Number.isFinite(Number(commRaw))
      ? Number(commRaw)
      : existingRow.commissionRate
    const normalized = normalizeAffiliateCommissionRatePct(commFallback, listingKind)
    if (!normalized.ok) {
      return Response.json({ error: normalized.error }, { status: 400 })
    }
    rate = normalized.rate

    stock = Math.max(
      0,
      Math.round(
        Number.isFinite(Number(body.stock)) ? Number(body.stock) : existingRow.stock
      )
    )
  }

  const activatingFromDraft = Boolean(existingRow.isDraft && publish)
  const desc = typeof body.description === "string" ? body.description.trim() : ""
  const descriptionBulletsPatch =
    "descriptionBullets" in rawBody
      ? parseDescriptionBullets((rawBody as Record<string, unknown>).descriptionBullets)
      : undefined
  const images = parseSupplierProductImages(body as unknown as Record<string, unknown>)
  const attr = parseProductAttributesBody(body as unknown as Record<string, unknown>)
  const ship = parseSupplierProductShippingBody(body as unknown as Record<string, unknown>)
  const meta = parseProductMarketplaceMeta(body as unknown as Record<string, unknown>)
  const categoryId =
    typeof body.categoryId === "string" && body.categoryId.trim().length ? body.categoryId.trim() : null
  const productAttributes = Array.isArray(body.productAttributes)
    ? body.productAttributes
        .map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>) : null))
        .filter((row): row is Record<string, unknown> => row != null)
        .map((row) => ({
          key: String(row.key ?? "").trim(),
          label: String(row.label ?? row.key ?? "").trim(),
          value: String(row.value ?? "").trim(),
        }))
        .filter((r) => r.key.length > 0 && r.value.length > 0)
    : []

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({
      where: { id },
      data: {
        name: nameResolved,
        description: desc,
        ...(descriptionBulletsPatch !== undefined
          ? { descriptionBullets: descriptionBulletsPatch }
          : {}),
        images,
        colorImages:
          attr.colorImages === null
            ? Prisma.DbNull
            : (attr.colorImages as unknown as Prisma.InputJsonValue),
        categories: attr.categories,
        colors: attr.colors,
        tags: attr.tags,
        variants:
          attr.variants === null
            ? Prisma.DbNull
            : (attr.variants as unknown as Prisma.InputJsonValue),
        basePriceCents: priceCents,
        compareAt,
        commissionRate: rate,
        listingKind,
        stock,
        categoryId,
        shippingCountry: ship.shippingCountry,
        warehouseType: ship.warehouseType,
        warehouseCity: ship.warehouseCity,
        processingTime: ship.processingTime,
        deliveryMin: ship.deliveryMin,
        deliveryMax: ship.deliveryMax,
        shippingMethods: ship.shippingMethods,
        freeShippingThreshold: ship.freeShippingThreshold,
        shippingCost: ship.shippingCost,
        shipsFrom: meta.shipsFrom,
        deliveryDays: meta.deliveryDays,
        freeShipping: meta.freeShipping,
        supplierTag: meta.supplierTag,
        ...(existingRow.isDraft && !publish ? { active: false, isDraft: true } : {}),
        ...(existingRow.isDraft && publish ? { active: true, isDraft: false } : {}),
      },
    })

    await tx.productAttribute.deleteMany({ where: { productId: id } })
    if (productAttributes.length) {
      await tx.productAttribute.createMany({
        data: productAttributes.map((a) => ({
          productId: id,
          key: a.key,
          label: a.label || a.key,
          value: a.value,
        })),
      })
    }
    return p
  })

  if (activatingFromDraft) {
    const supplierStore = await prisma.store.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (supplierStore) {
      try {
        await createNewDropCommunityPost({
          storeId: supplierStore.id,
          productId: updated.id,
          productName: updated.name,
        })
      } catch {
        /* non-fatal */
      }
    }
  }

  return Response.json(updated)
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const own = await assertOwnProduct(session.user.id, id)
  if (!own) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const orderCount = await prisma.order.count({ where: { productId: id } })
  if (orderCount > 0) {
    return Response.json({ error: "Cannot delete a product that has orders" }, { status: 409 })
  }

  await prisma.$transaction([
    prisma.affiliateProduct.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ])

  return new Response(null, { status: 204 })
}
