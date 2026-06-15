import { render } from "@react-email/render"
import { Resend } from "resend"

import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import { expansionCountryLabel, loadAdminExpansionOverview } from "@/lib/admin/load-admin-expansion-overview"
import { resolveExpansionAdminEmail } from "@/lib/admin/resolve-expansion-admin-email"
import { buildGraduatedThisMonthDigestLines } from "@/lib/expansion/expansion-digest-graduated-month"
import { findGraduationEmailStalls } from "@/lib/expansion/graduation-email-stall"
import { logBusiness } from "@/lib/business-log"
import {
  readResendDeliveryConfig,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type RunExpansionDigestCronResult = {
  sent: boolean
  skipped?: string
  recipient?: string
}

function digestWeekKey(now: Date): string {
  const year = now.getUTCFullYear()
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86_400_000 + jan1.getUTCDay() + 1) / 7)
  return `${year}-W${String(week).padStart(2, "0")}`
}

async function resolveDigestRecipient(): Promise<string | null> {
  return resolveExpansionAdminEmail()
}

function buildDigestBody(
  overview: Awaited<ReturnType<typeof loadAdminExpansionOverview>>,
  enabledWithoutOrder: Array<{ countryIso2: string; openedAt: Date; launchEmailSentAt: Date | null }>,
  graduationEmailStalls: Array<{ countryIso2: string; graduatedAt: Date }>
): string {
  const topDemand = overview.countries.slice(0, 5)
  const lines = [
    `Region: ${MARKET_REGION.toUpperCase()}`,
    `Live checkout countries: ${overview.liveCheckoutCount}`,
    `ROW rollouts enabled: ${overview.rolloutCount}`,
    `Graduated (permanent): ${overview.graduatedCount}`,
    ...buildGraduatedThisMonthDigestLines(
      overview.graduatedThisMonth,
      overview.graduatedThisMonthCountries,
      (iso2) => expansionCountryLabel(iso2, "en")
    ),
    "",
    `Graduation emails sent: ${overview.funnel.graduationsWithBuyerEmail}`,
    `Graduation emails pending: ${overview.funnel.graduationEmailsPending}`,
    `Total waitlist signups: ${overview.totalWaitlist}`,
    "",
    "Top demand:",
    ...topDemand.map(
      (row) =>
        `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.waitlistCount} signups` +
        (row.enabled ? " · checkout ON" : "") +
        (row.graduationEmailSentAt ? " · graduation emails sent" : row.graduatedAt ? " · graduation emails pending" : "")
    ),
    "",
    "Enabled without first order:",
    ...(enabledWithoutOrder.length > 0
      ? enabledWithoutOrder.map(
          (row) =>
            `• ${row.countryIso2} — opened ${row.openedAt.toISOString().slice(0, 10)}` +
            (row.launchEmailSentAt ? ` · notified ${row.launchEmailSentAt.toISOString().slice(0, 10)}` : "")
        )
      : ["• none"]),
    "",
    "Graduation emails stalled 48h+:",
    ...(graduationEmailStalls.length > 0
      ? graduationEmailStalls.map(
          (row) =>
            `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — graduated ${row.graduatedAt.toISOString().slice(0, 10)}`
        )
      : ["• none"]),
    "",
    `Console: ${resolveAppUrl()}/admin/expansion`,
  ]
  return lines.join("\n")
}

/** Weekly founder digest — top waitlist demand + rollouts without first order. */
export async function runExpansionDigestCron(now = new Date()): Promise<RunExpansionDigestCronResult> {
  const id = `cron:expansion-digest:${digestWeekKey(now)}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (existing) {
    return { sent: false, skipped: "already_sent_this_week" }
  }

  const recipient = await resolveDigestRecipient()
  if (!recipient) {
    return { sent: false, skipped: "no_recipient" }
  }

  const config = readResendDeliveryConfig()
  if (!config) {
    return { sent: false, skipped: "resend_not_configured" }
  }

  const overview = await loadAdminExpansionOverview()
  const enabledWithoutOrder = await prisma.checkoutCountryRollout.findMany({
    where: {
      marketRegion: MARKET_REGION,
      enabled: true,
      firstOrderAt: null,
    },
    select: { countryIso2: true, openedAt: true, launchEmailSentAt: true },
    orderBy: { openedAt: "desc" },
    take: 8,
  })

  const graduationPending = await prisma.checkoutCountryRollout.findMany({
    where: {
      marketRegion: MARKET_REGION,
      graduatedAt: { not: null },
      graduationEmailSentAt: null,
    },
    select: { countryIso2: true, graduatedAt: true },
  })
  const graduationEmailStalls = findGraduationEmailStalls(
    graduationPending.map((row) => ({
      countryIso2: row.countryIso2,
      graduatedAt: row.graduatedAt!,
    }))
  )

  const bodyText = buildDigestBody(overview, enabledWithoutOrder, graduationEmailStalls)
  const adminConsoleUrl = `${resolveAppUrl()}/admin/expansion`
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("expansion-digest", recipient, config)
  const html = await render(
    ExpansionDigestEmail({
      bodyText,
      adminConsoleUrl,
      graduationPendingCount: overview.funnel.graduationEmailsPending,
    })
  )

  const { error } = await resend.emails.send({
    from: config.from,
    to,
    subject: `Affisell expansion digest · ${MARKET_REGION.toUpperCase()}`,
    html,
  })

  if (error) {
    logBusiness("expansion-rollout", { result: "digest_failed", error: error.message })
    return { sent: false, skipped: error.message }
  }

  await prisma.processedWebhook.create({
    data: { id, status: "success" },
  })

  logBusiness("expansion-rollout", {
    result: "digest_sent",
    marketRegion: MARKET_REGION,
    recipient: to,
    topCountry: overview.countries[0]?.countryIso2 ?? null,
  })

  return { sent: true, recipient: to }
}
