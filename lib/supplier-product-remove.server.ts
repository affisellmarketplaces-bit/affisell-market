import "server-only"

import { cancelAuctionsForListings } from "@/lib/auction-listing-lifecycle"
import { primaryProductImage } from "@/lib/product-images"
import { prisma } from "@/lib/prisma"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"
import { revalidateSupplierShopfront } from "@/lib/revalidate-supplier-shopfront"
import { SUPPLIER_PRODUCT_RECALL_NOTIF } from "@/lib/supplier-product-recall-notif-constants"
import {
  resolveSupplierProductRemoveAction,
  SUPPLIER_PRODUCT_REMOVE_CODE,
  type SupplierProductRemoveImpact,
} from "@/lib/supplier-product-remove-shared"

type ProductRow = {
  id: string
  name: string
  isDraft: boolean
  active: boolean
  images: string[]
  _count: {
    orders: number
    affiliateProducts: number
  }
}

async function loadOwnedProductRow(
  supplierId: string,
  productId: string
): Promise<(ProductRow & { listedAffiliateCount: number }) | null> {
  const row = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: {
      id: true,
      name: true,
      isDraft: true,
      active: true,
      images: true,
      _count: {
        select: {
          orders: true,
          affiliateProducts: true,
        },
      },
    },
  })
  if (!row) return null

  const listedAffiliateCount = await prisma.affiliateProduct.count({
    where: { productId, isListed: true },
  })

  return { ...row, listedAffiliateCount }
}

function toImpact(
  row: ProductRow & { listedAffiliateCount: number }
): SupplierProductRemoveImpact {
  const isLive = row.active && !row.isDraft
  return {
    productId: row.id,
    productName: row.name,
    isDraft: row.isDraft,
    isLive,
    orderCount: row._count.orders,
    listedAffiliateCount: row.listedAffiliateCount,
    totalAffiliateListingCount: row._count.affiliateProducts,
    action: resolveSupplierProductRemoveAction({
      isDraft: row.isDraft,
      active: row.active,
      orderCount: row._count.orders,
      listedAffiliateCount: row.listedAffiliateCount,
    }),
  }
}

export async function getSupplierProductRemoveImpact(
  supplierId: string,
  productId: string
): Promise<SupplierProductRemoveImpact | null> {
  const row = await loadOwnedProductRow(supplierId, productId)
  if (!row) return null
  return toImpact(row)
}

export type DeleteSupplierProductResult =
  | { ok: true }
  | {
      ok: false
      code: string
      message: string
      listedAffiliateCount?: number
    }

/** Hard-delete when safe — blocked when orders exist or partners list live. */
export async function deleteSupplierProduct(
  supplierId: string,
  productId: string
): Promise<DeleteSupplierProductResult> {
  const row = await loadOwnedProductRow(supplierId, productId)
  if (!row) {
    return {
      ok: false,
      code: SUPPLIER_PRODUCT_REMOVE_CODE.NOT_FOUND,
      message: "Produit introuvable.",
    }
  }

  const impact = toImpact(row)
  if (impact.action === "blocked_orders") {
    return {
      ok: false,
      code: SUPPLIER_PRODUCT_REMOVE_CODE.HAS_ORDERS,
      message: "Impossible de supprimer un produit qui a déjà des commandes.",
    }
  }
  if (impact.action === "recall") {
    return {
      ok: false,
      code: SUPPLIER_PRODUCT_REMOVE_CODE.REQUIRES_RECALL,
      message:
        "Ce produit est en vitrine chez des revendeurs — utilisez le rappel produit pour le retirer du réseau.",
      listedAffiliateCount: row.listedAffiliateCount,
    }
  }
  if (impact.action === "none") {
    return {
      ok: false,
      code: SUPPLIER_PRODUCT_REMOVE_CODE.NOT_LIVE,
      message: "Ce produit est déjà retiré du catalogue.",
    }
  }

  await prisma.$transaction([
    prisma.affiliateProduct.deleteMany({ where: { productId } }),
    prisma.product.delete({ where: { id: productId, supplierId } }),
  ])

  console.log("[supplier-product-remove]", {
    supplierId,
    productId,
    action: "delete",
    listedAffiliateCount: row.listedAffiliateCount,
  })

  void revalidateSupplierShopfront(supplierId)
  return { ok: true }
}

export type RecallSupplierProductResult =
  | {
      ok: true
      listedAffiliatesUnlisted: number
      auctionsCancelled: number
      notificationsSent: number
    }
  | { ok: false; code: string; message: string }

async function notifyAffiliatesOfProductRecall(args: {
  productId: string
  productName: string
  productImages: string[]
  listingIds: string[]
}): Promise<number> {
  if (args.listingIds.length === 0) return 0

  const listings = await prisma.affiliateProduct.findMany({
    where: { id: { in: args.listingIds } },
    select: { id: true, affiliateId: true },
  })

  const thumb = primaryProductImage(args.productImages) ?? null
  let sent = 0

  for (const listing of listings) {
    await prisma.notification.create({
      data: {
        userId: listing.affiliateId,
        type: SUPPLIER_PRODUCT_RECALL_NOTIF,
        message: `Le fournisseur a rappelé « ${args.productName} » — retirez-le de votre vitrine si besoin.`,
        imageUrl: thumb,
        orderId: listing.id,
      },
    })
    sent++
  }

  return sent
}

/** Deactivate supplier SKU + unlist all live partner storefronts (idempotent). */
export async function recallSupplierProduct(
  supplierId: string,
  productId: string
): Promise<RecallSupplierProductResult> {
  const row = await loadOwnedProductRow(supplierId, productId)
  if (!row) {
    return {
      ok: false,
      code: SUPPLIER_PRODUCT_REMOVE_CODE.NOT_FOUND,
      message: "Produit introuvable.",
    }
  }

  const isLive = row.active && !row.isDraft
  if (row.listedAffiliateCount === 0) {
    if (isLive) {
      return {
        ok: false,
        code: SUPPLIER_PRODUCT_REMOVE_CODE.NOT_LIVE,
        message: "Aucun revendeur en vitrine — supprimez le produit directement.",
      }
    }
    return {
      ok: false,
      code: SUPPLIER_PRODUCT_REMOVE_CODE.ALREADY_RECALLED,
      message: "Ce produit est déjà retiré du réseau partenaires.",
    }
  }

  const listedRows = await prisma.affiliateProduct.findMany({
    where: { productId, isListed: true },
    select: { id: true, affiliateId: true },
  })
  const listingIds = listedRows.map((r) => r.id)

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId, supplierId },
      data: { active: false, isDraft: true },
    }),
    ...(listingIds.length > 0
      ? [
          prisma.affiliateProduct.updateMany({
            where: { productId, isListed: true },
            data: { isListed: false, isFeatured: false, auctionEligible: false },
          }),
        ]
      : []),
  ])

  const auctionsCancelled =
    listingIds.length > 0 ? await cancelAuctionsForListings(listingIds) : 0

  const notificationsSent = await notifyAffiliatesOfProductRecall({
    productId,
    productName: row.name,
    productImages: row.images,
    listingIds,
  })

  const affiliateIds = [...new Set(listedRows.map((r) => r.affiliateId))]
  void revalidateSupplierShopfront(supplierId)
  for (const affiliateId of affiliateIds) {
    void revalidateAffiliateShopfront(affiliateId)
  }

  console.log("[supplier-product-recall]", {
    supplierId,
    productId,
    listedAffiliatesUnlisted: listingIds.length,
    auctionsCancelled,
    notificationsSent,
  })

  return {
    ok: true,
    listedAffiliatesUnlisted: listingIds.length,
    auctionsCancelled,
    notificationsSent,
  }
}
