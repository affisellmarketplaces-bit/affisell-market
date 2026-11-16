import "server-only"

import { createTranslator } from "next-intl"

import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"
import { loadAppMessages } from "@/lib/i18n-load-messages"
import { isAppLocale, type AppLocale } from "@/lib/i18n-locale"
import { profitAlertTexts } from "@/lib/intelligence/profit-alert-format"
import {
  PROFIT_ALERT_NOTIF,
  toProfitAlertPayload,
  type ProfitAlertChannel,
  type ProfitAlertPayload,
} from "@/lib/intelligence/profit-alert-types"
import { ALERT_COOLDOWN_DAYS, detectProfitAlerts } from "@/lib/intelligence/profit-alerts"
import { DAY_MS } from "@/lib/intelligence/order-aggregates"
import { loadResellerPerformance, RESELLER_PERIOD_DAYS } from "@/lib/intelligence/reseller-performance.server"
import { prisma } from "@/lib/prisma"
import { getAbsoluteUrl } from "@/lib/site-url"

/**
 * Proactive profitability alerts — detection run, idempotent recording, delivery per channel (commercial intelligence).
 *
 * Idempotence, in the DATABASE (migration 20261117120000_reseller_profit_alerts), never in memory:
 *  - the alert row: UNIQUE (affiliateId, dedupeKey) + `createMany({ skipDuplicates })` (INSERT … ON CONFLICT DO
 *    NOTHING) — two concurrent runs create one alert, and only the run that created it goes on to deliver it;
 *  - each delivery: UNIQUE (alertId, channel), claimed the same way BEFORE sending. A run that dies after the claim
 *    leaves the row "sending": that alert is never sent twice (at most once, by design — a missed alert is better than a
 *    repeated one); it is visible in the reseller's alert list anyway.
 * Isolation: everything is read through loadResellerPerformance(affiliateId) (the reseller's own orders) and every row
 * carries the affiliateId it was computed for.
 * Channels: in-app (the existing Notification bell, type PROFIT_ALERT) and e-mail (the existing Resend helper), each
 * gated by ResellerAlertPreference (in-app on, e-mail OFF unless the reseller switched it on). A new channel = one entry
 * in PROFIT_ALERT_CHANNELS + its CHECK value + one branch in deliverOnChannel.
 */
export type AlertPreference = { inApp: boolean; email: boolean; locale: AppLocale }
const DEFAULT_PREFERENCE: AlertPreference = { inApp: true, email: false, locale: "fr" }

function isMissingTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /ResellerProfitAlert|ResellerAlertDelivery|ResellerAlertPreference|P2021|does not exist/i.test(message)
}

export async function loadAlertPreference(affiliateId: string): Promise<AlertPreference & { saved: boolean }> {
  try {
    const row = await prisma.resellerAlertPreference.findUnique({ where: { affiliateId } })
    if (!row) return { ...DEFAULT_PREFERENCE, saved: false }
    return { inApp: row.inApp, email: row.email, locale: isAppLocale(row.locale) ? row.locale : "fr", saved: true }
  } catch (error) {
    if (!isMissingTable(error)) throw error
    return { ...DEFAULT_PREFERENCE, saved: false }
  }
}

export async function saveAlertPreference(affiliateId: string, pref: AlertPreference): Promise<AlertPreference> {
  const data = { inApp: pref.inApp, email: pref.email, locale: pref.locale }
  await prisma.resellerAlertPreference.upsert({ where: { affiliateId }, create: { affiliateId, ...data }, update: data })
  return data
}

export function alertTranslator(locale: AppLocale) {
  return createTranslator({
    locale,
    messages: loadAppMessages(locale),
    namespace: "affiliate.profitAlerts",
    timeZone: "Europe/Paris",
  }) as unknown as (key: string, values?: Record<string, string | number>) => string
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

export function renderProfitAlertEmail(payload: ProfitAlertPayload, locale: AppLocale, links: { board: string; edit: string | null }) {
  const t = alertTranslator(locale)
  const x = profitAlertTexts(payload, t, locale)
  const li = x.causes.map((c) => `<li>${escapeHtml(c)}</li>`).join("")
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#18181b;max-width:560px;margin:auto;padding:24px">
<h2 style="font-size:18px">${escapeHtml(x.title)}</h2>
<p>${escapeHtml(x.change)}</p>
<p style="color:#52525b">${escapeHtml(x.since)}</p>
<p><strong>${escapeHtml(t("causesTitle"))}</strong></p><ul>${li}</ul>
<p><strong>${escapeHtml(t("suggestionTitle"))}</strong><br>${escapeHtml(x.suggestion)}</p>
<p><a href="${escapeHtml(links.edit ?? links.board)}" style="color:#6d28d9">${escapeHtml(links.edit ? t("ctaEdit") : t("ctaBoard"))}</a></p>
<p style="color:#71717a;font-size:12px">${escapeHtml(x.disclaimer)}</p>
<p style="color:#71717a;font-size:12px">${escapeHtml(t("emailFooter"))} <a href="${escapeHtml(links.board)}">${escapeHtml(t("ctaBoard"))}</a></p>
</body></html>`
  return { subject: x.short, html }
}

type DeliveryOutcome = { status: "sent" | "failed" | "skipped"; detail: string | null }

async function deliverOnChannel(
  channel: ProfitAlertChannel,
  alert: { id: string; affiliateId: string; listingId: string | null; payload: ProfitAlertPayload },
  pref: AlertPreference
): Promise<DeliveryOutcome> {
  const t = alertTranslator(pref.locale)
  if (channel === "in_app") {
    if (!pref.inApp) return { status: "skipped", detail: "preference_off" }
    const texts = profitAlertTexts(alert.payload, t, pref.locale)
    await prisma.notification.create({
      data: { userId: alert.affiliateId, type: PROFIT_ALERT_NOTIF, message: texts.short, orderId: alert.listingId },
    })
    return { status: "sent", detail: null }
  }
  // e-mail
  if (!pref.email) return { status: "skipped", detail: "preference_off" }
  const user = await prisma.user.findUnique({ where: { id: alert.affiliateId }, select: { email: true } })
  const to = user?.email?.trim()
  if (!to) return { status: "skipped", detail: "no_email" }
  const config = readResendDeliveryConfig()
  if (!config) return { status: "skipped", detail: "email_not_configured" }
  const board = getAbsoluteUrl("/dashboard/affiliate/opportunities")
  const edit = alert.listingId ? getAbsoluteUrl(`/dashboard/affiliate/products/${encodeURIComponent(alert.listingId)}/edit`) : null
  const { subject, html } = renderProfitAlertEmail(alert.payload, pref.locale, { board, edit })
  const sent = await sendResendEmail({ context: "reseller-profit-alert", config, intendedTo: to, subject, html })
  return sent.ok ? { status: "sent", detail: sent.resendId ?? null } : { status: "failed", detail: sent.error.slice(0, 200) }
}

/** Claims then delivers each channel of one alert. A channel already claimed (by this or another run) is left alone. */
export async function deliverProfitAlert(
  alert: { id: string; affiliateId: string; listingId: string | null; payload: ProfitAlertPayload },
  pref: AlertPreference,
  channels: readonly ProfitAlertChannel[] = ["in_app", "email"]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const channel of channels) {
    const claim = await prisma.resellerAlertDelivery.createMany({
      data: [{ alertId: alert.id, affiliateId: alert.affiliateId, channel, status: "sending" }],
      skipDuplicates: true,
    })
    if (claim.count === 0) {
      out[channel] = "already_claimed"
      continue
    }
    let outcome: DeliveryOutcome
    try {
      outcome = await deliverOnChannel(channel, alert, pref)
    } catch (error) {
      outcome = { status: "failed", detail: (error instanceof Error ? error.message : String(error)).slice(0, 200) }
    }
    await prisma.resellerAlertDelivery.updateMany({
      where: { alertId: alert.id, channel, status: "sending" },
      data: { status: outcome.status, detail: outcome.detail },
    })
    out[channel] = outcome.status
  }
  return out
}

export type ResellerAlertRun = { affiliateId: string; candidates: number; created: number; cooldown: number; duplicates: number }

/** Detects, records (idempotently) and delivers the alerts of ONE reseller. */
export async function runResellerProfitAlerts(args: { affiliateId: string; now?: Date }): Promise<ResellerAlertRun> {
  const now = args.now ?? new Date()
  const performance = await loadResellerPerformance({ affiliateId: args.affiliateId, now, limit: 100 })
  const candidates = detectProfitAlerts({
    performance,
    now,
    periodStart: new Date(now.getTime() - RESELLER_PERIOD_DAYS * DAY_MS),
  })
  const run: ResellerAlertRun = { affiliateId: args.affiliateId, candidates: candidates.length, created: 0, cooldown: 0, duplicates: 0 }
  if (candidates.length === 0) return run
  const pref = await loadAlertPreference(args.affiliateId)
  const cooldownSince = new Date(now.getTime() - ALERT_COOLDOWN_DAYS * DAY_MS)

  for (const c of candidates) {
    const recent = await prisma.resellerProfitAlert.findFirst({
      where: { affiliateId: args.affiliateId, productId: c.productId, createdAt: { gte: cooldownSince } },
      select: { id: true },
    })
    if (recent) {
      run.cooldown += 1
      continue
    }
    const payload = toProfitAlertPayload(c)
    const inserted = await prisma.resellerProfitAlert.createMany({
      data: [
        {
          affiliateId: args.affiliateId,
          productId: c.productId,
          listingId: c.listingId,
          dedupeKey: c.dedupeKey,
          primaryCause: c.primaryCause,
          causes: c.causes,
          previousNetCents: c.previousNetCents,
          currentNetCents: c.currentNetCents,
          netChangeCents: c.netChangeCents,
          since: new Date(c.sinceIso),
          payload,
        },
      ],
      skipDuplicates: true,
    })
    if (inserted.count === 0) {
      run.duplicates += 1
      continue
    }
    const alert = await prisma.resellerProfitAlert.findUnique({
      where: { affiliateId_dedupeKey: { affiliateId: args.affiliateId, dedupeKey: c.dedupeKey } },
      select: { id: true, affiliateId: true, listingId: true },
    })
    if (!alert) continue
    run.created += 1
    await deliverProfitAlert({ ...alert, payload }, pref)
  }
  return run
}

/** Daily pass over every reseller with paid orders in the last 60 days (bounded). One failure never stops the others. */
export async function runProfitAlertsForAllResellers(args: { now?: Date; maxResellers?: number } = {}) {
  const now = args.now ?? new Date()
  const max = Math.max(1, Math.min(args.maxResellers ?? 300, 2000))
  const since = new Date(now.getTime() - 2 * RESELLER_PERIOD_DAYS * DAY_MS)
  const resellers = await prisma.order.findMany({
    where: { paidAt: { gte: since } },
    distinct: ["affiliateId"],
    select: { affiliateId: true },
    orderBy: { affiliateId: "asc" },
    take: max,
  })
  const summary = { resellers: resellers.length, created: 0, cooldown: 0, duplicates: 0, failed: 0, notMigrated: false }
  for (const r of resellers) {
    try {
      const run = await runResellerProfitAlerts({ affiliateId: r.affiliateId, now })
      summary.created += run.created
      summary.cooldown += run.cooldown
      summary.duplicates += run.duplicates
    } catch (error) {
      if (isMissingTable(error)) {
        summary.notMigrated = true
        console.warn("[profit-alerts]", { result: "tables_missing" })
        break
      }
      summary.failed += 1
      console.error("[profit-alerts]", {
        result: "reseller_failed",
        affiliateId: r.affiliateId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return summary
}

export type ResellerAlertRow = {
  id: string
  productId: string
  listingId: string | null
  payload: ProfitAlertPayload
  createdAt: string
}

/** The reseller's own alerts (newest first), for the board. Missing table = none. */
export async function loadResellerAlerts(affiliateId: string, take = 20): Promise<ResellerAlertRow[]> {
  try {
    const rows = await prisma.resellerProfitAlert.findMany({
      where: { affiliateId, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, productId: true, listingId: true, payload: true, createdAt: true },
    })
    return rows.map((r: { id: string; productId: string; listingId: string | null; payload: unknown; createdAt: Date }) => ({
      id: r.id,
      productId: r.productId,
      listingId: r.listingId,
      payload: r.payload as ProfitAlertPayload,
      createdAt: r.createdAt.toISOString(),
    }))
  } catch (error) {
    if (!isMissingTable(error)) throw error
    return []
  }
}
