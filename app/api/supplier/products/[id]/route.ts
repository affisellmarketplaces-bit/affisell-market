import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { findSupplierProductGuardForPut } from "@/lib/supplier-product-is-draft-fallback"
import { createNewDropCommunityPost } from "@/lib/community-new-drop"
import { scheduleProductAutoCategorization } from "@/lib/product-auto-categorize"
import { parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import { parseCompareAtDraftLax, parseCompareAtStrict } from "@/lib/supplier-product-compare-at"
import { parseDescriptionBullets } from "@/lib/supplier-product-description-bullets"
import {
  parseDescriptionIllustrationImages,
  parseDescriptionIllustrationVideos,
} from "@/lib/supplier-product-description-illustrations"
import { parseProductMarketplaceMeta } from "@/lib/supplier-product-marketplace-meta"
import { parseSupplierProductShippingBody } from "@/lib/supplier-product-shipping"
import { parseSupplierProductImages } from "@/lib/supplier-product-images"
import {
  defaultAffiliateCommissionPct,
  normalizeAffiliateCommissionRatePct,
  parseListingKind,
} from "@/lib/supplier-commission"
import {
  parseCustomColumnsFromBody,
  parseCustomColumnsFromDb,
  validateVariantsCustomData,
} from "@/lib/product-custom-columns"
import {
  applyCustomColumnsToVariantRows,
  isSkuVariantsSyncBody,
  parseProductVariantsFromBody,
  serializeProductVariantRow,
  syncProductVariants,
} from "@/lib/product-variant-sku"
import type { CustomColumn } from "@/types/product"

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

  const p = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    include: {
      attributes: { orderBy: { label: "asc" } },
      productVariants: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!p) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const variants = p.productVariants.map((v) =>
    serializeProductVariantRow(v, p.commissionRate)
  )

  return Response.json({
    ...p,
    compareAt: p.compareAt != null ? Number(p.compareAt) : null,
    freeShippingThreshold: p.freeShippingThreshold != null ? Number(p.freeShippingThreshold) : null,
    shippingCost: Number(p.shippingCost),
    listingKind: parseListingKind(p.listingKind),
    hasVariants: p.hasVariants,
    listingVariants: p.variants,
    customColumns: parseCustomColumnsFromDb(p.customColumns),
    variants,
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
  const draftUpdateOnly = existingRow.isDraft && !publish

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
  const descriptionIllustrationImagesPatch =
    "descriptionIllustrationImages" in rawBody
      ? parseDescriptionIllustrationImages(rawBody)
      : undefined
  const descriptionIllustrationVideosPatch =
    "descriptionIllustrationVideos" in rawBody
      ? parseDescriptionIllustrationVideos(rawBody)
      : undefined
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

  let customColumnsUpdate: CustomColumn[] | undefined
  if ("customColumns" in rawBody) {
    const parsed = parseCustomColumnsFromBody(rawBody)
    if (!Array.isArray(parsed)) {
      return Response.json({ error: parsed.error }, { status: 400 })
    }
    customColumnsUpdate = parsed
  }

  const rawSkuVariants = Array.isArray(rawBody.variants) ? rawBody.variants : []
  const variantPatch = isSkuVariantsSyncBody(rawBody)
    ? parseProductVariantsFromBody({
        hasVariants: rawBody.hasVariants,
        variants: rawBody.variants,
      })
    : null

  if (variantPatch && "error" in variantPatch) {
    if (!draftUpdateOnly) {
      return Response.json(
        { error: variantPatch.error, issues: variantPatch.issues },
        { status: 400 }
      )
    }
    // Brouillon : on enregistre le reste même si le tableau SKU est incomplet.
  }

  if (variantPatch && !("error" in variantPatch)) {
    const cols =
      customColumnsUpdate ??
      parseCustomColumnsFromDb(
        (
          await prisma.product.findUnique({
            where: { id },
            select: { customColumns: true },
          })
        )?.customColumns
      )
    const customErr = validateVariantsCustomData(cols, rawSkuVariants)
    if (customErr && !draftUpdateOnly) {
      return Response.json({ error: customErr }, { status: 400 })
    }
    if (cols.length > 0) {
      variantPatch.variants = applyCustomColumnsToVariantRows(
        variantPatch.variants,
        cols,
        rawSkuVariants
      )
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({
      where: { id },
      data: {
        name: nameResolved,
        description: desc,
        ...(descriptionBulletsPatch !== undefined
          ? { descriptionBullets: descriptionBulletsPatch }
          : {}),
        ...(descriptionIllustrationImagesPatch !== undefined
          ? { descriptionIllustrationImages: descriptionIllustrationImagesPatch }
          : {}),
        ...(descriptionIllustrationVideosPatch !== undefined
          ? { descriptionIllustrationVideos: descriptionIllustrationVideosPatch }
          : {}),
        images,
        /** Only touch merchandising JSON when the client sends the key — step-1 autosaves omit these. */
        ...("colorImages" in rawBody
          ? {
              colorImages:
                attr.colorImages === null
                  ? Prisma.DbNull
                  : (attr.colorImages as unknown as Prisma.InputJsonValue),
            }
          : {}),
        ...("categories" in rawBody ? { categories: attr.categories } : {}),
        ...("colors" in rawBody ? { colors: attr.colors } : {}),
        ...("tags" in rawBody ? { tags: attr.tags } : {}),
        ...("listingVariants" in rawBody ||
        (typeof rawBody.variants === "object" &&
          rawBody.variants !== null &&
          !Array.isArray(rawBody.variants))
          ? {
              variants:
                attr.variants === null
                  ? Prisma.DbNull
                  : (attr.variants as unknown as Prisma.InputJsonValue),
            }
          : {}),
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
        ...("customColumns" in rawBody
          ? {
              customColumns:
                customColumnsUpdate && customColumnsUpdate.length > 0
                  ? (customColumnsUpdate as unknown as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            }
          : {}),
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

    if (variantPatch && !("error" in variantPatch)) {
      await syncProductVariants(tx, id, variantPatch.hasVariants, variantPatch.variants)
    }

    return p
  })

  const fresh = await prisma.product.findUnique({
    where: { id },
    include: { productVariants: { orderBy: { createdAt: "asc" } } },
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

  const isLive = !updated.isDraft && updated.active
  const savedCategoryId = categoryId ?? updated.categoryId
  if (isLive && !savedCategoryId) {
    scheduleProductAutoCategorization(updated.id)
  } else if (
    updated.isDraft &&
    !publish &&
    !savedCategoryId &&
    nameResolved.trim().length >= 5
  ) {
    scheduleProductAutoCategorization(updated.id, { allowDraft: true })
  }

  return Response.json({
    ...(fresh ?? updated),
    variants: (fresh?.productVariants ?? []).map((v) =>
      serializeProductVariantRow(v, fresh?.commissionRate ?? updated.commissionRate)
    ),
  })
}

/** Partial update: SKU table + simple price/stock (avoids wiping listing fields). */
export async function PATCH(
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
  const variantPatch = parseProductVariantsFromBody({
    hasVariants: rawBody.hasVariants,
    variants: rawBody.variants,
  })
  if ("error" in variantPatch) {
    return Response.json(
      { error: variantPatch.error, issues: variantPatch.issues },
      { status: 400 }
    )
  }

  const commRaw = rawBody.commission ?? rawBody.commissionRate
  const listingKind = parseListingKind(rawBody.listingKind)
  let commissionUpdate: number | undefined
  if (commRaw != null && Number.isFinite(Number(commRaw))) {
    const normalized = normalizeAffiliateCommissionRatePct(Number(commRaw), listingKind)
    if (!normalized.ok) {
      return Response.json({ error: normalized.error }, { status: 400 })
    }
    commissionUpdate = normalized.rate
  }

  await prisma.$transaction(async (tx) => {
    const data: Prisma.ProductUpdateInput = {}
    if (typeof rawBody.name === "string" && rawBody.name.trim()) {
      data.name = rawBody.name.trim().slice(0, 500)
    }
    if (commissionUpdate != null) {
      data.commissionRate = commissionUpdate
    }
    if (!variantPatch.hasVariants) {
      const price = Number(rawBody.price)
      if (Number.isFinite(price) && price > 0) {
        data.basePriceCents = Math.max(100, Math.round(price * 100))
      }
      const stock = Number(rawBody.stock)
      if (Number.isFinite(stock)) {
        data.stock = Math.max(0, Math.round(stock))
      }
    }
    if (Object.keys(data).length) {
      await tx.product.update({ where: { id }, data })
    }
    await syncProductVariants(tx, id, variantPatch.hasVariants, variantPatch.variants)
  })

  const fresh = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    include: { productVariants: { orderBy: { createdAt: "asc" } } },
  })
  if (!fresh) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json({
    ...fresh,
    compareAt: fresh.compareAt != null ? Number(fresh.compareAt) : null,
    shippingCost: Number(fresh.shippingCost),
    variants: fresh.productVariants.map((v) =>
      serializeProductVariantRow(v, fresh.commissionRate)
    ),
  })
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
