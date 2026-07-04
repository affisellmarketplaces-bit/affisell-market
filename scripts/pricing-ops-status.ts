/**
 * Pricing ops status — live DB counters for founder / Metabase sanity check.
 * Run: npm run pricing:ops-status
 */
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

async function main() {
  const [
    listingsWithVariantPricing,
    autoAdjustEnabled,
    marginReviewOpen,
    pushSubscriptionsAffiliate,
  ] = await Promise.all([
    prisma.affiliateProduct.count({
      where: { NOT: { variantPricing: { equals: Prisma.DbNull } } },
    }),
    prisma.affiliateProduct.count({
      where: { pricingAutoAdjust: true },
    }),
    prisma.affiliateProduct.count({
      where: { marginReviewNeeded: true },
    }),
    prisma.pushSubscription.count({
      where: { user: { role: "AFFILIATE" } },
    }),
  ])

  const autoAdjustDue = await prisma.affiliateProduct.count({
    where: {
      pricingAutoAdjust: true,
      OR: [
        { pricingAutoAdjustLastRun: null },
        {
          pricingAutoAdjustLastRun: {
            lt: new Date(new Date().setUTCHours(0, 0, 0, 0)),
          },
        },
      ],
    },
  })

  console.log("[pricing-ops-status]", {
    listingsWithVariantPricing,
    autoAdjustEnabled,
    autoAdjustDueToday: autoAdjustDue,
    marginReviewOpen,
    affiliatePushSubscriptions: pushSubscriptionsAffiliate,
  })

  console.log("\nPricing ops — next actions:")
  if (marginReviewOpen > 0) {
    console.log(`  • ${marginReviewOpen} listing(s) need margin review — affiliates notified`)
  }
  if (autoAdjustEnabled > 0) {
    console.log(
      `  • ${autoAdjustEnabled} listing(s) on auto-adjust (${autoAdjustDue} due today UTC cron)`
    )
  }
  if (pushSubscriptionsAffiliate === 0) {
    console.log("  • No affiliate push subscriptions — prompt on /dashboard/affiliate/earnings")
  }
  console.log("  • npm run pricing:ops-playbook — full prod checklist\n")
}

main()
  .catch((e) => {
    console.error("[pricing-ops-status]", {
      result: "failed",
      error: e instanceof Error ? e.message : String(e),
    })
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
