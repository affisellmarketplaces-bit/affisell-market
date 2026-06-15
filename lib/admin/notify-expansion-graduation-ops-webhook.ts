import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

export type NotifyGraduationOpsWebhookResult = {
  sent: boolean
  skipped: boolean
  slack: boolean
  discord: boolean
}

/** Slack/Discord ops ping when a country graduates (idempotent). Requires SLACK_WEBHOOK_URL or DISCORD_WEBHOOK_URL. */
export async function notifyExpansionGraduationOpsWebhook(
  countryRaw: string,
  firstOrderId: string | null
): Promise<NotifyGraduationOpsWebhookResult> {
  const countryIso2 = normalizeVisitorCountryIso2(countryRaw)
  if (!countryIso2) {
    return { sent: false, skipped: true, slack: false, discord: false }
  }

  const id = `expansion:ops-webhook-graduation:${MARKET_REGION}:${countryIso2}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (existing) {
    return { sent: false, skipped: true, slack: false, discord: false }
  }

  const countryName = expansionCountryLabel(countryIso2, "en")
  const adminUrl = `${resolveAppUrl()}/admin/expansion`
  const orderBit = firstOrderId ? ` First order: \`${firstOrderId}\`.` : ""
  const text = `🌍 *${countryName} (${countryIso2})* graduated to permanent Affisell checkout.${orderBit} <${adminUrl}|Open expansion console>`

  const { slack, discord } = await opsWebhookAlert(text)
  if (!slack && !discord) {
    return { sent: false, skipped: true, slack: false, discord: false }
  }

  await prisma.processedWebhook.create({
    data: { id, status: "success" },
  })

  logBusiness("expansion-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "graduation_ops_webhook_sent",
    slack,
    discord,
    firstOrderId,
  })

  return { sent: true, skipped: false, slack, discord }
}
