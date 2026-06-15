import { render } from "@react-email/render"
import { Resend } from "resend"

import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import { expansionCountryLabel, loadAdminExpansionOverview } from "@/lib/admin/load-admin-expansion-overview"
import { resolveExpansionAdminEmail } from "@/lib/admin/resolve-expansion-admin-email"
import { expansionBouncesExportPath, expansionComplaintsExportPath, expansionDeliveredExportPath } from "@/lib/admin/expansion-email-export-kinds"
import {
  graduationBounceDigestBadge,
  shouldShowGraduationHighBounceDigestRow,
} from "@/lib/expansion/expansion-digest-graduation-bounce-badge"
import { shouldShowFollowupDeliveredDigestRow } from "@/lib/expansion/expansion-digest-followup-complaint-badge"
import {
  followupPausedDigestBadge,
  followupPausedDigestExportSuffix,
  shouldShowFollowupPausedDigestRow,
} from "@/lib/expansion/expansion-digest-followup-pause-badge"
import {
  followupBounceDigestBadge,
  shouldShowFollowupHighBounceDigestRow,
} from "@/lib/expansion/expansion-digest-followup-bounce-badge"
import {
  buildExpansionDigestCountryQuickExportLine,
  buildExpansionDigestGlobalQuickExportLines,
  hasExpansionQuickExportActivity,
} from "@/lib/expansion/expansion-digest-quick-exports"
import {
  followupDeliveryDigestBadge,
  shouldShowFollowupLowDeliveryDigestRow,
} from "@/lib/expansion/expansion-digest-followup-delivery-badge"
import {
  launchComplaintDigestBadge,
  shouldShowLaunchComplaintDigestRow,
} from "@/lib/expansion/expansion-digest-launch-complaint-badge"
import {
  launchBounceDigestBadge,
  shouldShowLaunchHighBounceDigestRow,
} from "@/lib/expansion/expansion-digest-launch-bounce-badge"
import {
  launchDeliveryDigestBadge,
  shouldShowLaunchDeliveredDigestRow,
  shouldShowLaunchLowDeliveryDigestRow,
  shouldShowLaunchNotifyPausedDigestRow,
} from "@/lib/expansion/expansion-digest-launch-delivery-badge"
import {
  graduationComplaintDigestBadge,
  shouldShowGraduationComplaintDigestRow,
} from "@/lib/expansion/expansion-digest-graduation-complaint-badge"
import {
  graduationPausedDigestBadge,
  graduationPausedDigestExportSuffix,
  shouldShowGraduationPausedDigestRow,
} from "@/lib/expansion/expansion-digest-graduation-pause-badge"
import { buildGraduatedThisMonthDigestLines } from "@/lib/expansion/expansion-digest-graduated-month"
import {
  graduationDeliveryDigestBadge,
  shouldShowGraduationLowDeliveryDigestRow,
} from "@/lib/expansion/expansion-digest-graduation-delivery-badge"
import { resolveGraduatedBuyerShopUrl } from "@/lib/expansion/graduated-buyer-shop-url"
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
  const adminUrl = resolveAppUrl()
  const topDemand = overview.countries.slice(0, 5)
  const quickExportCountries = overview.countries.filter(hasExpansionQuickExportActivity).slice(0, 5)
  const lines = [
    `Region: ${MARKET_REGION.toUpperCase()}`,
    `Live checkout countries: ${overview.liveCheckoutCount}`,
    `ROW rollouts enabled: ${overview.rolloutCount}`,
    `Graduated (permanent): ${overview.graduatedCount}`,
    ...buildGraduatedThisMonthDigestLines(
      overview.graduatedThisMonth,
      overview.graduatedThisMonthCountries,
      (iso2) => expansionCountryLabel(iso2, "en"),
      (iso2) => resolveGraduatedBuyerShopUrl(iso2)
    ),
    "",
    `Graduation emails sent: ${overview.funnel.graduationsWithBuyerEmail}`,
    `Graduation emails pending: ${overview.funnel.graduationEmailsPending}`,
    `Expansion email bounces (month): ${overview.emailBounces.bouncesThisMonth}`,
    `Expansion email complaints (month): ${overview.emailBounces.complaintsThisMonth}`,
    `Email events (month): ${overview.emailEventCounts.deliveredThisMonth} delivered · ${overview.emailEventCounts.bouncesThisMonth} bounce(s) · ${overview.emailEventCounts.complaintsThisMonth} complaint(s)`,
    ...buildExpansionDigestGlobalQuickExportLines(adminUrl),
    ...(quickExportCountries.length > 0
      ? [
          "Metabase quick exports by country:",
          ...quickExportCountries.map((row) =>
            buildExpansionDigestCountryQuickExportLine(
              adminUrl,
              expansionCountryLabel(row.countryIso2, "en"),
              row
            )
          ),
        ]
      : []),
    `Launch emails pending retry: ${overview.emailBounces.launchRetriesPending}`,
    `Launch emails suppressed (2nd bounce): ${overview.emailBounces.launchSuppressedTotal}`,
    `Suppressed waitlist pending 90d purge: ${overview.emailBounces.suppressedStalePendingPurge}`,
    "",
    "Launch notify auto-paused (delivery <50%, auto-resume at 80%):",
    ...(overview.countries.filter((row) =>
      shouldShowLaunchNotifyPausedDigestRow({ launchNotifyPaused: row.launchNotifyPaused })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowLaunchNotifyPausedDigestRow({ launchNotifyPaused: row.launchNotifyPaused })
          )
          .slice(0, 8)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchDeliveryRatePct}% delivered${launchDeliveryDigestBadge(row.launchDeliveryRatePct)} — ${adminUrl}${expansionDeliveredExportPath(row.countryIso2, "checkout-launch")}`
          )
      : ["• none"]),
    "",
    "Launch notify email delivery by country (month, min 10 notified):",
    ...(overview.countries.filter((row) =>
      shouldShowLaunchDeliveredDigestRow({
        notifiedCount: row.funnel.notifiedCount,
        launchEmailsDeliveredThisMonth: row.launchEmailsDeliveredThisMonth,
      })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowLaunchDeliveredDigestRow({
              notifiedCount: row.funnel.notifiedCount,
              launchEmailsDeliveredThisMonth: row.launchEmailsDeliveredThisMonth,
            })
          )
          .slice(0, 5)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchDeliveryRatePct}% (${row.launchEmailsDeliveredThisMonth} delivered)${launchDeliveryDigestBadge(row.launchDeliveryRatePct)} — ${adminUrl}${expansionDeliveredExportPath(row.countryIso2, "checkout-launch")}`
          )
      : ["• none"]),
    "",
    "Email delivery by kind (month):",
    ...(overview.emailKindStats.length > 0
      ? overview.emailKindStats.map(
          (row) =>
            `• ${row.emailKind} — ${row.deliveredThisMonth} delivered · ${row.bouncesThisMonth} bounce(s) · ${row.complaintsThisMonth} complaint(s)`
        )
      : ["• none"]),
    "",
    "Countries with email complaints (month):",
    ...(overview.countries.filter((row) =>
      shouldShowLaunchComplaintDigestRow({
        launchComplaintsThisMonth: row.launchComplaintsThisMonth,
      })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowLaunchComplaintDigestRow({
              launchComplaintsThisMonth: row.launchComplaintsThisMonth,
            })
          )
          .slice(0, 5)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchComplaintsThisMonth} complaint(s) (${row.launchComplaintRatePct}% of notified)${launchComplaintDigestBadge(row.launchComplaintRatePct)} — ${adminUrl}${expansionComplaintsExportPath(row.countryIso2, "checkout-launch")}`
          )
      : ["• none"]),
    "",
    "Graduation complaint alert by country (month, min 10 sent):",
    ...(overview.countries.filter((row) =>
      shouldShowGraduationComplaintDigestRow({
        launchGraduatedSentThisMonth: row.launchGraduatedSentThisMonth,
        launchGraduatedComplaintsThisMonth: row.launchGraduatedComplaintsThisMonth,
      })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowGraduationComplaintDigestRow({
              launchGraduatedSentThisMonth: row.launchGraduatedSentThisMonth,
              launchGraduatedComplaintsThisMonth: row.launchGraduatedComplaintsThisMonth,
            })
          )
          .slice(0, 8)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchGraduatedComplaintsThisMonth} graduation complaint(s) (${row.launchGraduatedComplaintRatePct}% of sent)${graduationComplaintDigestBadge({
                launchGraduatedComplaintRatePct: row.launchGraduatedComplaintRatePct,
                graduationEmailPaused: row.graduationEmailPaused,
              })} — ${adminUrl}${expansionComplaintsExportPath(row.countryIso2, "checkout-graduated")}`
          )
      : ["• none"]),
    "",
    "Graduation emails auto-paused (complaint or delivery <50%):",
    ...(overview.countries.filter((row) =>
      shouldShowGraduationPausedDigestRow({ graduationEmailPaused: row.graduationEmailPaused })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowGraduationPausedDigestRow({ graduationEmailPaused: row.graduationEmailPaused })
          )
          .slice(0, 8)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchGraduatedComplaintsThisMonth} graduation complaint(s) · ${row.launchGraduatedDeliveryRatePct}% delivered (auto-resume: 30d clear if complaint pause · ≥80% if delivery pause)${graduationPausedDigestBadge({
                launchGraduatedComplaintsThisMonth: row.launchGraduatedComplaintsThisMonth,
                launchGraduatedDeliveryRatePct: row.launchGraduatedDeliveryRatePct,
              })}${graduationPausedDigestExportSuffix({
                adminUrl,
                countryIso2: row.countryIso2,
                launchGraduatedComplaintsThisMonth: row.launchGraduatedComplaintsThisMonth,
                launchGraduatedDeliveryRatePct: row.launchGraduatedDeliveryRatePct,
              })}`
          )
      : ["• none"]),
    "",
    "Graduation email delivery by country (month, min 10 sent):",
    ...(overview.countries.filter(
      (row) => row.launchGraduatedSentThisMonth >= 10 && row.launchGraduatedDeliveredThisMonth > 0
    ).length > 0
      ? overview.countries
          .filter(
            (row) => row.launchGraduatedSentThisMonth >= 10 && row.launchGraduatedDeliveredThisMonth > 0
          )
          .slice(0, 5)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchGraduatedDeliveryRatePct}% (${row.launchGraduatedDeliveredThisMonth} graduation delivered)${graduationDeliveryDigestBadge(row.launchGraduatedDeliveryRatePct)} — ${adminUrl}${expansionDeliveredExportPath(row.countryIso2, "checkout-graduated")}`
          )
      : ["• none"]),
    "",
    "Low graduation email delivery rate (<80%):",
    ...(overview.countries.filter((row) =>
      shouldShowGraduationLowDeliveryDigestRow({
        launchGraduatedSentThisMonth: row.launchGraduatedSentThisMonth,
        launchGraduatedDeliveryRatePct: row.launchGraduatedDeliveryRatePct,
      })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowGraduationLowDeliveryDigestRow({
              launchGraduatedSentThisMonth: row.launchGraduatedSentThisMonth,
              launchGraduatedDeliveryRatePct: row.launchGraduatedDeliveryRatePct,
            })
          )
          .slice(0, 5)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchGraduatedDeliveryRatePct}% (${row.launchGraduatedDeliveredThisMonth} graduation delivered)${graduationDeliveryDigestBadge(row.launchGraduatedDeliveryRatePct)} — ${adminUrl}${expansionDeliveredExportPath(row.countryIso2, "checkout-graduated")}`
          )
      : ["• none"]),
    "",
    "High graduation email bounce rate (>5%):",
    ...(overview.countries.filter((row) =>
      shouldShowGraduationHighBounceDigestRow({
        launchGraduatedSentThisMonth: row.launchGraduatedSentThisMonth,
        launchGraduatedBouncesThisMonth: row.launchGraduatedBouncesThisMonth,
      })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowGraduationHighBounceDigestRow({
              launchGraduatedSentThisMonth: row.launchGraduatedSentThisMonth,
              launchGraduatedBouncesThisMonth: row.launchGraduatedBouncesThisMonth,
            })
          )
          .slice(0, 5)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchGraduatedBounceRatePct}% (${row.launchGraduatedBouncesThisMonth} bounce(s) / ${row.launchGraduatedSentThisMonth} sent)${graduationBounceDigestBadge(row.launchGraduatedBounceRatePct)} — ${adminUrl}${expansionBouncesExportPath(row.countryIso2, "checkout-graduated")}`
          )
      : ["• none"]),
    "",
    "J+2 follow-up auto-paused (complaint or delivery <50%):",
    ...(overview.countries.filter((row) =>
      shouldShowFollowupPausedDigestRow({ launchFollowupPaused: row.launchFollowupPaused })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowFollowupPausedDigestRow({ launchFollowupPaused: row.launchFollowupPaused })
          )
          .slice(0, 8)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchFollowupComplaintsThisMonth} follow-up complaint(s) · ${row.launchFollowupDeliveryRatePct}% J+2 delivered (auto-resume after 30d clear or ≥80%)${followupPausedDigestBadge({
                launchFollowupComplaintsThisMonth: row.launchFollowupComplaintsThisMonth,
                launchFollowupDeliveryRatePct: row.launchFollowupDeliveryRatePct,
              })}${followupPausedDigestExportSuffix({
                adminUrl,
                countryIso2: row.countryIso2,
                launchFollowupComplaintsThisMonth: row.launchFollowupComplaintsThisMonth,
                launchFollowupDeliveryRatePct: row.launchFollowupDeliveryRatePct,
              })}`
          )
      : ["• none"]),
    "",
    "J+2 follow-up email delivery by country (month, min 10 sent):",
    ...(overview.countries.filter((row) =>
      shouldShowFollowupDeliveredDigestRow({
        followUpCount: row.funnel.followUpCount,
        launchFollowupDeliveredThisMonth: row.launchFollowupDeliveredThisMonth,
      })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowFollowupDeliveredDigestRow({
              followUpCount: row.funnel.followUpCount,
              launchFollowupDeliveredThisMonth: row.launchFollowupDeliveredThisMonth,
            })
          )
          .slice(0, 5)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchFollowupDeliveryRatePct}% (${row.launchFollowupDeliveredThisMonth} J+2 delivered)${followupDeliveryDigestBadge(row.launchFollowupDeliveryRatePct)} — ${adminUrl}${expansionDeliveredExportPath(row.countryIso2, "checkout-launch-followup")}`
          )
      : ["• none"]),
    "",
    "Low J+2 follow-up delivery rate (<80%):",
    ...(overview.countries.filter((row) =>
      shouldShowFollowupLowDeliveryDigestRow({
        followUpCount: row.funnel.followUpCount,
        launchFollowupDeliveryRatePct: row.launchFollowupDeliveryRatePct,
      })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowFollowupLowDeliveryDigestRow({
              followUpCount: row.funnel.followUpCount,
              launchFollowupDeliveryRatePct: row.launchFollowupDeliveryRatePct,
            })
          )
          .slice(0, 5)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchFollowupDeliveryRatePct}% (${row.launchFollowupDeliveredThisMonth} J+2 delivered)${followupDeliveryDigestBadge(row.launchFollowupDeliveryRatePct)} — ${adminUrl}${expansionDeliveredExportPath(row.countryIso2, "checkout-launch-followup")}`
          )
      : ["• none"]),
    "",
    "High J+2 follow-up email bounce rate (>5%):",
    ...(overview.countries.filter((row) =>
      shouldShowFollowupHighBounceDigestRow({
        launchFollowupSentThisMonth: row.launchFollowupSentThisMonth,
        launchFollowupBouncesThisMonth: row.launchFollowupBouncesThisMonth,
      })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowFollowupHighBounceDigestRow({
              launchFollowupSentThisMonth: row.launchFollowupSentThisMonth,
              launchFollowupBouncesThisMonth: row.launchFollowupBouncesThisMonth,
            })
          )
          .slice(0, 5)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchFollowupBounceRatePct}% (${row.launchFollowupBouncesThisMonth} bounce(s) / ${row.launchFollowupSentThisMonth} sent)${followupBounceDigestBadge(row.launchFollowupBounceRatePct)} — ${adminUrl}${expansionBouncesExportPath(row.countryIso2, "checkout-launch-followup")}`
          )
      : ["• none"]),
    "",
    "High launch notify bounce rate (>5%):",
    ...(overview.countries.filter((row) =>
      shouldShowLaunchHighBounceDigestRow({
        notifiedCount: row.funnel.notifiedCount,
        retriesPending: row.launchBounceRetriesPending,
        suppressed: row.launchBounceSuppressed,
      })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowLaunchHighBounceDigestRow({
              notifiedCount: row.funnel.notifiedCount,
              retriesPending: row.launchBounceRetriesPending,
              suppressed: row.launchBounceSuppressed,
            })
          )
          .slice(0, 5)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchBounceRatePct}% bounce (${row.launchBounceRetriesPending + row.launchBounceSuppressed} affected / ${row.funnel.notifiedCount + row.launchBounceRetriesPending} notified)${launchBounceDigestBadge(row.launchBounceRatePct)} — ${adminUrl}${expansionBouncesExportPath(row.countryIso2, "checkout-launch")}`
          )
      : ["• none"]),
    "",
    "Low delivery rate (<80%):",
    ...(overview.countries.filter((row) =>
      shouldShowLaunchLowDeliveryDigestRow({
        notifiedCount: row.funnel.notifiedCount,
        launchDeliveryRatePct: row.launchDeliveryRatePct,
      })
    ).length > 0
      ? overview.countries
          .filter((row) =>
            shouldShowLaunchLowDeliveryDigestRow({
              notifiedCount: row.funnel.notifiedCount,
              launchDeliveryRatePct: row.launchDeliveryRatePct,
            })
          )
          .slice(0, 5)
          .map(
            (row) =>
              `• ${expansionCountryLabel(row.countryIso2, "en")} (${row.countryIso2}) — ${row.launchDeliveryRatePct}% (${row.launchEmailsDeliveredThisMonth} delivered)${launchDeliveryDigestBadge(row.launchDeliveryRatePct)} — ${adminUrl}${expansionDeliveredExportPath(row.countryIso2, "checkout-launch")}`
          )
      : ["• none"]),
    "",
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
    `Console: ${adminUrl}/admin/expansion`,
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
  const graduatedBrowseLinks = overview.graduatedThisMonthCountries.slice(0, 3).map((row) => ({
    label: expansionCountryLabel(row.countryIso2, "en"),
    url: resolveGraduatedBuyerShopUrl(row.countryIso2),
  }))
  const resend = new Resend(config.apiKey)
  const { to } = resolveResendDeliveryRecipient("expansion-digest", recipient, config)
  const html = await render(
    ExpansionDigestEmail({
      bodyText,
      adminConsoleUrl,
      graduationPendingCount: overview.funnel.graduationEmailsPending,
      graduatedBrowseLinks,
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
