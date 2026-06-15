import { render } from "@react-email/render"
import { Resend } from "resend"

import { ExpansionGraduationFounderAlertEmail } from "@/emails/expansion-graduation-founder-alert"
import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { resolveExpansionAdminEmail } from "@/lib/admin/resolve-expansion-admin-email"
import { logBusiness } from "@/lib/business-log"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

export type NotifyFounderGraduationResult = {
  sent: boolean
  skipped: boolean
  reason?: string
}

/** Instant founder alert when a ROW country graduates (idempotent per country). */
export async function notifyFounderCheckoutCountryGraduated(
  countryRaw: string,
  firstOrderId: string | null
): Promise<NotifyFounderGraduationResult> {
  const countryIso2 = normalizeVisitorCountryIso2(countryRaw)
  if (!countryIso2) {
    return { sent: false, skipped: true, reason: "invalid_country" }
  }

  const id = `expansion:founder-graduation:${MARKET_REGION}:${countryIso2}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (existing) {
    return { sent: false, skipped: true, reason: "already_sent" }
  }

  const recipient = await resolveExpansionAdminEmail()
  if (!recipient) {
    return { sent: false, skipped: true, reason: "no_recipient" }
  }

  const config = readResendDeliveryConfig()
  if (!config) {
    return { sent: false, skipped: true, reason: "resend_not_configured" }
  }

  const countryName = expansionCountryLabel(countryIso2, "en")
  const adminConsoleUrl = `${resolveAppUrl()}/admin/expansion`
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("expansion-graduation-founder", recipient, config)

  const html = await render(
    ExpansionGraduationFounderAlertEmail({
      countryName,
      countryIso2,
      adminConsoleUrl,
      firstOrderId,
    })
  )

  const { error } = await resend.emails.send({
    from: config.from,
    to,
    subject: `Affisell · ${countryName} graduated to permanent checkout`,
    html,
  })

  if (error) {
    console.error("[expansion-rollout]", {
      country: countryIso2,
      result: "founder_graduation_alert_failed",
      error: error.message,
    })
    return { sent: false, skipped: false, reason: error.message }
  }

  await prisma.processedWebhook.create({
    data: { id, status: "success" },
  })

  logBusiness("expansion-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "founder_graduation_alert_sent",
    firstOrderId,
    recipient: to,
  })

  return { sent: true, skipped: false }
}
