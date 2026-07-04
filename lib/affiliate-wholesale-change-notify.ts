import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"
import { sendAffiliateWholesaleChangeEmail } from "@/lib/emails/send-affiliate-wholesale-change"
import { notifyAffiliateWholesaleChangePush } from "@/lib/affiliate-wholesale-change-push"
import {
  SUPPLIER_PRICE_CHANGE_NOTIF,
} from "@/lib/affiliate-wholesale-change-notif-constants"
import {
  buildWholesaleSnapshot,
  detectWholesaleIncreases,
  evaluateListingMarginReview,
  parseListingVariantPricing,
  wholesaleSnapshotHash,
  type WholesaleSnapshot,
} from "@/lib/affiliate-wholesale-change-guard"

export async function notifyAffiliatesOfWholesaleChange(args: {
  productId: string
  productName: string
  productImages: string[]
  before: WholesaleSnapshot
  after: WholesaleSnapshot
}): Promise<{ listingsFlagged: number; notificationsSent: number }> {
  const beforeHash = wholesaleSnapshotHash(args.before)
  const afterHash = wholesaleSnapshotHash(args.after)
  if (beforeHash === afterHash) {
    return { listingsFlagged: 0, notificationsSent: 0 }
  }

  const increases = detectWholesaleIncreases(args.before, args.after)
  if (increases.length === 0) {
    return { listingsFlagged: 0, notificationsSent: 0 }
  }

  const listings = await prisma.affiliateProduct.findMany({
    where: { productId: args.productId },
    select: {
      id: true,
      affiliateId: true,
      sellingPriceCents: true,
      variantPricing: true,
      marginReviewAlertHash: true,
      affiliate: { select: { email: true, name: true } },
    },
  })

  let listingsFlagged = 0
  let notificationsSent = 0
  const thumb = primaryProductImage(args.productImages) ?? null

  for (const listing of listings) {
    const variantPricing = parseListingVariantPricing(listing.variantPricing)
    const review = evaluateListingMarginReview({
      sellingPriceCents: listing.sellingPriceCents,
      variantPricing,
      wholesaleAfter: args.after,
      increases,
    })

    if (!review.needed) {
      if (listing.marginReviewAlertHash) {
        await prisma.affiliateProduct.update({
          where: { id: listing.id },
          data: {
            marginReviewNeeded: false,
            marginReviewVariantKeys: [],
            marginReviewAt: null,
            marginReviewAlertHash: null,
          },
        })
      }
      continue
    }

    listingsFlagged++
    const shouldNotify = listing.marginReviewAlertHash !== afterHash

    await prisma.affiliateProduct.update({
      where: { id: listing.id },
      data: {
        marginReviewNeeded: true,
        marginReviewAt: new Date(),
        marginReviewVariantKeys: review.variantKeys,
        ...(shouldNotify ? { marginReviewAlertHash: afterHash } : {}),
      },
    })

    if (!shouldNotify) continue

    const variantNote =
      review.variantKeys.length > 0
        ? `${review.variantKeys.length} variante(s)`
        : "prix de base"
    const lossNote = review.atLoss ? " — vente à perte possible" : ""
    const message = `Prix fournisseur en hausse sur « ${args.productName} » (${variantNote})${lossNote}.`

    await prisma.notification.create({
      data: {
        userId: listing.affiliateId,
        type: SUPPLIER_PRICE_CHANGE_NOTIF,
        message,
        imageUrl: thumb,
        orderId: listing.id,
      },
    })
    notificationsSent++

    void notifyAffiliateWholesaleChangePush({
      affiliateId: listing.affiliateId,
      listingId: listing.id,
      productName: args.productName,
      atLoss: review.atLoss,
      variantCount: review.variantKeys.length,
    }).catch((e) => {
      console.error("[wholesale-change-guard]", {
        listingId: listing.id,
        result: "push_failed",
        error: e instanceof Error ? e.message : String(e),
      })
    })

    const email = listing.affiliate.email?.trim()
    if (email) {
      void sendAffiliateWholesaleChangeEmail({
        toEmail: email,
        affiliateName: listing.affiliate.name?.trim() ?? "",
        productName: args.productName,
        variantCount: review.variantKeys.length,
        atLoss: review.atLoss,
        productId: args.productId,
        listingId: listing.id,
      }).catch((e) => {
        console.error("[wholesale-change-guard]", {
          listingId: listing.id,
          result: "email_failed",
          error: e instanceof Error ? e.message : String(e),
        })
      })
    }

    console.log("[wholesale-change-guard]", {
      productId: args.productId,
      listingId: listing.id,
      result: "flagged",
      atLoss: review.atLoss,
      variantKeys: review.variantKeys,
      afterHash,
    })
  }

  return { listingsFlagged, notificationsSent }
}

export async function notifyAffiliatesAfterSupplierProductSave(args: {
  productId: string
  before: WholesaleSnapshot
}): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: args.productId },
    select: {
      id: true,
      name: true,
      images: true,
      basePriceCents: true,
      variants: true,
      colors: true,
      hasVariants: true,
      productVariants: {
        select: {
          color: true,
          size: true,
          stock: true,
          supplierPrice: true,
          wholesalePriceCents: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!product) return

  const after = buildWholesaleSnapshot(product)
  const result = await notifyAffiliatesOfWholesaleChange({
    productId: product.id,
    productName: product.name,
    productImages: product.images,
    before: args.before,
    after,
  })

  if (result.listingsFlagged > 0 || result.notificationsSent > 0) {
    console.log("[wholesale-change-guard]", {
      productId: product.id,
      listingsFlagged: result.listingsFlagged,
      notificationsSent: result.notificationsSent,
    })
  }
}

export function captureWholesaleSnapshotFromProductRow(product: {
  basePriceCents: number
  variants: unknown
  colors?: string[]
  hasVariants?: boolean
  productVariants?: Array<{
    color: string | null
    size: string | null
    stock: number
    supplierPrice?: unknown
    wholesalePriceCents?: number | null
  }>
}): WholesaleSnapshot {
  return buildWholesaleSnapshot(product)
}
