import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { sendWishlistPriceAlertEmail } from "@/lib/emails/send-wishlist-price-alert"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import { sendPriceDropPushToUser } from "@/lib/web-push-send"
import {
  evaluateWishlistPriceAlert,
  formatWishlistPriceEur,
  wishlistListingUrl,
} from "@/lib/wishlist-price-alert"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const rows = await prisma.wishlist.findMany({
    take: 500,
    include: {
      user: { select: { id: true, email: true, name: true } },
      product: {
        select: {
          id: true,
          name: true,
          affiliateProducts: {
            where: buyerListedAffiliateProductWhere,
            take: 1,
            orderBy: { id: "asc" },
            select: { id: true, sellingPriceCents: true },
          },
        },
      },
    },
  })

  let emailsSent = 0
  let pushesSent = 0
  let updates = 0

  for (const w of rows) {
    const listing = w.product.affiliateProducts[0]
    if (!listing) continue

    const current = listing.sellingPriceCents
    const evaluation = evaluateWishlistPriceAlert({
      currentPriceCents: current,
      previousPriceCents: w.previousPriceCents,
      targetPriceCents: w.targetPriceCents,
    })

    if (evaluation.shouldAlert) {
      const listingUrl = wishlistListingUrl(listing.id)
      const currentPriceLabel = formatWishlistPriceEur(current)

      if (w.user.email) {
        const emailed = await sendWishlistPriceAlertEmail({
          toEmail: w.user.email,
          customerName: w.user.name?.trim() || "",
          productName: w.product.name,
          listingUrl,
          currentPriceCents: current,
          targetPriceCents: w.targetPriceCents,
          evaluation,
        })
        if (emailed) emailsSent++
      }

      const pushCount = await sendPriceDropPushToUser({
        userId: w.user.id,
        productName: w.product.name,
        listingUrl,
        currentPriceLabel,
        dropPercent: evaluation.dropPercent,
      })
      pushesSent += pushCount
    }

    await prisma.wishlist.update({
      where: { userId_productId: { userId: w.userId, productId: w.productId } },
      data: { previousPriceCents: current },
    })
    updates++
  }

  console.log("[wishlist-price-alerts]", { updates, emailsSent, pushesSent })
  return NextResponse.json({ ok: true, updates, emailsSent, pushesSent })
}
