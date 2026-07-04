import { sendWholesaleChangePushToUser } from "@/lib/web-push-send"

export async function notifyAffiliateWholesaleChangePush(args: {
  affiliateId: string
  listingId: string
  productName: string
  atLoss: boolean
  variantCount: number
}): Promise<void> {
  const sent = await sendWholesaleChangePushToUser({
    userId: args.affiliateId,
    listingId: args.listingId,
    productName: args.productName,
    atLoss: args.atLoss,
    variantCount: args.variantCount,
  })

  console.log("[wholesale-change-push]", {
    listingId: args.listingId,
    affiliateId: args.affiliateId,
    result: sent > 0 ? "sent" : "skipped_no_subscription",
    count: sent,
  })
}
