import type { ResendWebhookEmailData } from "@/lib/resend-webhook/expansion-email-delivery"
import { readExpansionCountryFromResendTags } from "@/lib/expansion/expansion-email-tags"
import { resolveExpansionEmailKind } from "@/lib/expansion/resolve-expansion-email-kind"
import { isExpansionBuyerResendEmail } from "@/lib/resend-webhook/expansion-email-delivery"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type ExpansionCountryDeliveryStats = {
  deliveredThisMonth: number
}

export type ExpansionCountryDeliveryStatsMap = Map<string, ExpansionCountryDeliveryStats>

function monthStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

function parseDeliveryMeta(error: string | null | undefined): string | null {
  if (!error) return null
  const countryIso2 = error.split(":")[0]?.trim().toLowerCase()
  return countryIso2 && countryIso2.length === 2 ? countryIso2 : null
}

export async function loadExpansionCountryDeliveryStats(
  now = new Date()
): Promise<ExpansionCountryDeliveryStatsMap> {
  const rows = await prisma.processedWebhook.findMany({
    where: {
      status: "expansion_delivered",
      createdAt: { gte: monthStartUtc(now) },
    },
    select: { error: true },
  })

  const map: ExpansionCountryDeliveryStatsMap = new Map()
  for (const row of rows) {
    const countryIso2 = parseDeliveryMeta(row.error)
    if (!countryIso2) continue
    const existing = map.get(countryIso2)?.deliveredThisMonth ?? 0
    map.set(countryIso2, { deliveredThisMonth: existing + 1 })
  }

  return map
}

export type ProcessExpansionResendDeliveredResult = {
  handled: boolean
  webhookStatus: "expansion_delivered" | null
  countryIso2: string | null
}

export async function processExpansionResendDeliveredEvent(
  event: { type: string; data: ResendWebhookEmailData },
  emailId: string
): Promise<ProcessExpansionResendDeliveredResult> {
  if (event.type !== "email.delivered") {
    return { handled: false, webhookStatus: null, countryIso2: null }
  }

  if (!isExpansionBuyerResendEmail(event.data)) {
    return { handled: false, webhookStatus: null, countryIso2: null }
  }

  const countryIso2 = readExpansionCountryFromResendTags(event.data.tags)
  const emailKind = resolveExpansionEmailKind(event.data) ?? "unknown"
  const deliveryId = `expansion:delivered:${emailId}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id: deliveryId } })
  if (existing) {
    return { handled: true, webhookStatus: "expansion_delivered", countryIso2 }
  }

  await prisma.processedWebhook.create({
    data: {
      id: deliveryId,
      status: "expansion_delivered",
      error: countryIso2 ? `${countryIso2}:${emailKind}` : emailKind,
    },
  })

  console.log("[expansion-rollout]", {
    result: "resend_delivered",
    marketRegion: MARKET_REGION,
    emailId,
    countryIso2,
    emailKind,
    recipient: event.data.to?.[0] ?? null,
  })

  return { handled: true, webhookStatus: "expansion_delivered", countryIso2 }
}

export function computeLaunchDeliveryRatePct(args: {
  deliveredThisMonth: number
  notifiedCount: number
}): number {
  if (args.deliveredThisMonth === 0 || args.notifiedCount === 0) return 0
  return Math.min(100, Math.round((args.deliveredThisMonth / args.notifiedCount) * 1000) / 10)
}
