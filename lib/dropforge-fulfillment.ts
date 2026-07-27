import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import type { DropForgeCompletePreview } from "@/lib/dropforge-complete-import"
import { prisma } from "@/lib/prisma"

export type DropForgeFulfillmentMeta = {
  fulfillmentReady: boolean
  /** Why live publish is allowed or blocked */
  fulfillmentReason: "aliexpress" | "catalog_link" | "pending_ops"
  aliexpressProductId: string | null
}

/**
 * DropForge can only go live when auto-buy has a SupplierLink path:
 * - AliExpress product id on the URL, or
 * - catalog Product that already has an active SupplierLink
 */
export function resolveDropForgeFulfillmentMeta(args: {
  sourceUrl: string
  catalogProductId?: string | null
  catalogHasSupplierLink?: boolean
}): DropForgeFulfillmentMeta {
  const aeId = parseAliExpressProductId(args.sourceUrl)
  if (aeId) {
    return {
      fulfillmentReady: true,
      fulfillmentReason: "aliexpress",
      aliexpressProductId: aeId,
    }
  }
  if (args.catalogProductId && args.catalogHasSupplierLink) {
    return {
      fulfillmentReady: true,
      fulfillmentReason: "catalog_link",
      aliexpressProductId: null,
    }
  }
  return {
    fulfillmentReady: false,
    fulfillmentReason: "pending_ops",
    aliexpressProductId: null,
  }
}

export async function catalogProductHasActiveSupplierLink(
  productId: string
): Promise<boolean> {
  const link = await prisma.supplierLink.findUnique({
    where: { productId },
    select: { id: true, isActive: true, autoBuyEnabled: true },
  })
  return Boolean(link?.isActive && link.autoBuyEnabled)
}

/** Attach fulfillment flags onto a DropForge preview (mutates + returns). */
export function withDropForgeFulfillment(
  preview: DropForgeCompletePreview,
  meta: DropForgeFulfillmentMeta
): DropForgeCompletePreview & DropForgeFulfillmentMeta {
  return {
    ...preview,
    fulfillmentReady: meta.fulfillmentReady,
    fulfillmentReason: meta.fulfillmentReason,
    aliexpressProductId: meta.aliexpressProductId,
  }
}

/**
 * Upsert SupplierLink for DropForge AliExpress imports so auto-buy
 * no longer fails with NO_SUPPLIER_LINK.
 */
export async function ensureDropForgeSupplierLink(args: {
  productId: string
  sourceUrl: string
  aeProductId: string
  aePriceCents: number
}): Promise<{ created: boolean; linkId: string }> {
  const aeUrl = args.sourceUrl.includes("aliexpress")
    ? args.sourceUrl
    : `https://www.aliexpress.com/item/${args.aeProductId}.html`
  const aePriceCents = Math.max(1, Math.round(args.aePriceCents))

  const existing = await prisma.supplierLink.findUnique({
    where: { productId: args.productId },
    select: { id: true },
  })

  const link = await prisma.supplierLink.upsert({
    where: { productId: args.productId },
    create: {
      productId: args.productId,
      aeProductId: args.aeProductId,
      aeSkuId: null,
      aeShopId: "",
      aePriceCents,
      aeShippingCents: 0,
      aeUrl,
      autoBuyEnabled: true,
      isActive: true,
      lastSyncAt: new Date(),
    },
    update: {
      aeProductId: args.aeProductId,
      aeUrl,
      aePriceCents,
      autoBuyEnabled: true,
      isActive: true,
      lastSyncAt: new Date(),
    },
    select: { id: true },
  })

  await prisma.product.update({
    where: { id: args.productId },
    data: {
      aliexpressProductId: args.aeProductId,
      sourceUrl: aeUrl,
      autoFulfill: true,
      autoBuyEnabled: true,
    },
  })

  console.log("[affiliate-url-import]", {
    stage: "supplier_link",
    productId: args.productId,
    aeProductId: args.aeProductId,
    linkId: link.id,
    result: existing ? "updated" : "created",
  })

  return { created: !existing, linkId: link.id }
}
