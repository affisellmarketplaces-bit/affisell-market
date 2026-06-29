import "server-only"

import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import { prisma } from "@/lib/prisma"

const MARKETPLACE_DONE = ["paid", "preparing", "shipped"] as const

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export type AffiliateDac7Summary = {
  year: number
  legalName: string
  countryCode: string
  transactionCount: number
  platformRevenueCents: number
  currency: string
}

export async function buildAffiliateDac7Summary(userId: string): Promise<AffiliateDac7Summary> {
  const year = new Date().getUTCFullYear()
  const from = new Date(Date.UTC(year, 0, 1))
  const to = new Date()

  const [profile, user, orders] = await Promise.all([
    prisma.merchantLegalProfile.findUnique({
      where: { userId },
      select: { legalEntityName: true, tradeName: true, countryCode: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    prisma.order.findMany({
      where: {
        affiliateId: userId,
        status: { in: [...MARKETPLACE_DONE] },
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        affiliatePayoutCents: true,
        affiliateMarginRetainedCents: true,
        affiliateFeeCents: true,
        affiliateMarginCents: true,
      },
    }),
  ])

  let platformRevenueCents = 0
  for (const o of orders) {
    platformRevenueCents += netAffiliateTransferCents({
      affiliatePayoutCents: o.affiliatePayoutCents,
      affiliateMarginRetainedCents: o.affiliateMarginRetainedCents,
      affiliateFeeCents: o.affiliateFeeCents,
      affiliateMarginCents: o.affiliateMarginCents,
    })
  }

  const legalName =
    profile?.legalEntityName?.trim() ||
    profile?.tradeName?.trim() ||
    user?.name?.trim() ||
    user?.email?.trim() ||
    "Partner"

  return {
    year,
    legalName,
    countryCode: profile?.countryCode?.trim().toUpperCase().slice(0, 2) || "FR",
    transactionCount: orders.length,
    platformRevenueCents,
    currency: "EUR",
  }
}

export async function buildAffiliateDac7Csv(userId: string): Promise<string> {
  const summary = await buildAffiliateDac7Summary(userId)
  const amountEur = (summary.platformRevenueCents / 100).toFixed(2)

  const header = [
    "reporting_year",
    "partner_legal_name",
    "country_code",
    "transaction_count",
    "platform_revenue_eur",
    "currency",
    "platform",
  ]

  const row = [
    String(summary.year),
    summary.legalName,
    summary.countryCode,
    String(summary.transactionCount),
    amountEur,
    summary.currency,
    "Affisell",
  ]

  return `${header.join(",")}\n${row.map((c) => csvEscape(c)).join(",")}\n`
}
