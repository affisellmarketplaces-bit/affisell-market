import "server-only"

import { render } from "@react-email/render"

import { UnallocatedLineNoticeEmail, type UnallocatedLineNoticeCopy } from "@/emails/unallocated-line-notice"
import { applyBrandToText, buildBrandedFrom, buyerEmailLinks, toEmailBrandProps } from "@/lib/emails/email-brand-shared"
import { resolveEmailBrandForAffiliate } from "@/lib/emails/email-brand.server"
import { interpolate } from "@/lib/emails/email-copy-utils"
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { tMessage } from "@/lib/i18n-pick-message"
import type { AppLocale } from "@/lib/i18n-locale"
import { intlLocaleTag } from "@/lib/i18n-ui-locale"
import { prisma } from "@/lib/prisma"
import { resolvePublicAppUrl } from "@/lib/public-app-url"
import { getStripeClient } from "@/lib/stripe"
import {
  BUYER_NOTICE_CLAIM_ACTION,
  BUYER_NOTICE_ENTITY_TYPE,
  BUYER_NOTICE_FAILED_ACTION,
  BUYER_NOTICE_SENT_ACTION,
  claimId,
  isBuyerNoticeEnabled,
  lineRefundState,
  noticeCopyKey,
  planBuyerNotice,
  sessionRefundState,
  verifiedRecipient,
  type NoticeKind,
  type NoticeRow,
  type RefundState,
} from "@/lib/unallocated-buyer-notice"
import { UNALLOCATED_LINE_AUDIT_ACTION, UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION } from "@/lib/unallocated-line"

export type UnallocatedSessionFacts = {
  lines: number
  state: RefundState
  amountCents: number
  currency: string
  affiliateProductId: string | null
}

type RefundStatusReader = (refundId: string) => Promise<string | null>

/** Stripe's status of a refund, `null` when it can not be read (the line then counts as `requested`, never more). */
export const readStripeRefundStatus: RefundStatusReader = async (refundId) => {
  try {
    const refund = await getStripeClient().refunds.retrieve(refundId)
    return typeof refund.status === "string" ? refund.status : null
  } catch {
    return null
  }
}

/** The lost lines of one checkout session and the REAL state of their refund. Reads only. */
export async function loadUnallocatedSessionFacts(sessionId: string, readStatus: RefundStatusReader = readStripeRefundStatus): Promise<UnallocatedSessionFacts> {
  const rows = await prisma.auditLog.findMany({
    where: { action: { in: [UNALLOCATED_LINE_AUDIT_ACTION, UNALLOCATED_LINE_REFUNDED_AUDIT_ACTION] }, entityId: { startsWith: `${sessionId}:line:` } },
    select: { action: true, entityId: true, payload: true },
    take: 200,
  })
  const prefix = `${sessionId}:line:`
  const traces = new Map<string, Record<string, unknown>>()
  const refundIds = new Map<string, string>()
  for (const r of rows) {
    if (!r.entityId?.startsWith(prefix) || !/^\d+$/.test(r.entityId.slice(prefix.length))) continue
    const p = (r.payload ?? {}) as Record<string, unknown>
    if (r.action === UNALLOCATED_LINE_AUDIT_ACTION) traces.set(r.entityId, p)
    else if (typeof p.stripeRefundId === "string" && p.stripeRefundId) refundIds.set(r.entityId, p.stripeRefundId)
  }
  const states: RefundState[] = []
  let amountCents = 0
  let currency = "eur"
  let affiliateProductId: string | null = null
  for (const [key, p] of traces) {
    const refundId = refundIds.get(key) ?? null
    states.push(lineRefundState(refundId, refundId ? await readStatus(refundId) : null))
    if (typeof p.refundableCents === "number" && Number.isInteger(p.refundableCents) && p.refundableCents > 0) amountCents += p.refundableCents
    if (typeof p.currency === "string" && p.currency) currency = p.currency
    if (!affiliateProductId && typeof p.affiliateProductId === "string") affiliateProductId = p.affiliateProductId
  }
  return { lines: traces.size, state: sessionRefundState(states), amountCents, currency, affiliateProductId }
}

function formatAmount(cents: number, currency: string, locale: AppLocale): string {
  try {
    return new Intl.NumberFormat(intlLocaleTag(locale), { style: "currency", currency: currency.toUpperCase() }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

/** The buyer's text: only resolved strings, never an id, a reason code or an address. */
export function buildNoticeCopy(locale: AppLocale, kind: NoticeKind, state: RefundState, amount: string): { subject: string; copy: UnallocatedLineNoticeCopy } {
  const t = (k: string) => tMessage(locale, `emails.unallocatedLine.${k}`)
  const confirmedKind = kind === "refund_confirmed"
  return {
    subject: t(confirmedKind ? "subjectConfirmed" : "subject"),
    copy: {
      preview: t(confirmedKind ? "previewConfirmed" : "preview"),
      heading: t(confirmedKind ? "headingConfirmed" : "heading"),
      greeting: t("greeting"),
      intro: t(confirmedKind ? "introConfirmed" : "intro"),
      amountLine: interpolate(t("amountLine"), { amount }),
      refundLine: t(`refund.${noticeCopyKey(kind, state)}`),
      ctaSupport: t("ctaSupport"),
      footerNote: t("footerNote"),
    },
  }
}

export type NoticeResult =
  | { status: "disabled" | "no_lines" | "not_configured" | "no_verified_recipient" | "session_unreadable" | "claimed_elsewhere" }
  | { status: "already_sent" | "nothing_new" | "in_flight" | "in_doubt" | "too_many_failures" }
  | { status: "sent" | "failed"; kind: NoticeKind; attempt: number; state: RefundState }

type Deps = {
  now?: Date
  readStatus?: RefundStatusReader
  retrieveSession?: (sessionId: string) => Promise<{ payment_status?: string | null; customer_details?: { email?: string | null } | null; metadata?: Record<string, string> | null } | null>
}

/**
 * Sends the next due notice of one checkout session to its buyer, at most once per kind. OFF unless
 * `UNALLOCATED_LINE_BUYER_EMAIL=true`. Never throws.
 */
export async function notifyUnallocatedBuyer(sessionId: string, deps: Deps = {}): Promise<NoticeResult> {
  if (!isBuyerNoticeEnabled()) return { status: "disabled" }
  const now = deps.now ?? new Date()
  try {
    const facts = await loadUnallocatedSessionFacts(sessionId, deps.readStatus)
    if (facts.lines === 0) return { status: "no_lines" }
    const rows: NoticeRow[] = await prisma.auditLog.findMany({
      where: { id: { startsWith: `unallocated-buyer-notice:${sessionId}:` } },
      select: { id: true, action: true, createdAt: true, payload: true },
      take: 50,
    })
    const plan = planBuyerNotice(sessionId, facts.state, rows, now)
    if (plan.action === "none") {
      if (plan.reason === "in_doubt") console.error("[unallocated-buyer-notice]", { metric: "in_doubt_not_retried", sessionId })
      return { status: plan.reason }
    }
    const config = readResendDeliveryConfig()
    if (!config) return { status: "not_configured" }

    let session: Awaited<ReturnType<NonNullable<Deps["retrieveSession"]>>>
    try {
      session = deps.retrieveSession ? await deps.retrieveSession(sessionId) : await getStripeClient().checkout.sessions.retrieve(sessionId)
    } catch {
      return { status: "session_unreadable" }
    }
    const to = verifiedRecipient(session)
    if (!to) return { status: "no_verified_recipient" }
    const locale = resolveEmailLocale(session?.metadata?.locale)

    // Claim BEFORE sending: one deterministic row per attempt; a concurrent run hits the primary key and stops.
    const id = claimId(sessionId, plan.kind, plan.attempt)
    try {
      await prisma.auditLog.create({
        data: { id, action: BUYER_NOTICE_CLAIM_ACTION, entityType: BUYER_NOTICE_ENTITY_TYPE, entityId: sessionId, payload: { kind: plan.kind, attempt: plan.attempt, state: facts.state, locale } },
      })
    } catch {
      return { status: "claimed_elsewhere" }
    }

    let affiliateId: string | null = null
    if (facts.affiliateProductId) {
      affiliateId = (await prisma.affiliateProduct.findUnique({ where: { id: facts.affiliateProductId }, select: { affiliateId: true } }).catch(() => null))?.affiliateId ?? null
    }
    const brand = await resolveEmailBrandForAffiliate(affiliateId)
    const supportUrl = buyerEmailLinks(brand, resolvePublicAppUrl()).support("").replace(/\?order=$/, "")
    const { subject, copy } = buildNoticeCopy(locale, plan.kind, facts.state, formatAmount(facts.amountCents, facts.currency, locale))
    const branded = Object.fromEntries(Object.entries(copy).map(([k, v]) => [k, applyBrandToText(v, brand)])) as UnallocatedLineNoticeCopy
    const html = await render(UnallocatedLineNoticeEmail({ copy: branded, supportUrl, brand: toEmailBrandProps(brand) }))

    const result = await sendResendEmail({
      context: "unallocated-buyer-notice",
      config: { ...config, from: buildBrandedFrom(config.from, brand) },
      intendedTo: to,
      subject: applyBrandToText(subject, brand),
      html,
      idempotencyKey: id,
    })
    const outcome = result.ok
      ? { id: `${id}:sent`, action: BUYER_NOTICE_SENT_ACTION, payload: { resendId: result.resendId ?? null } }
      : { id: `${id}:failed`, action: BUYER_NOTICE_FAILED_ACTION, payload: { error: result.error === "invalid_recipient" ? "invalid_recipient" : "provider_error" } }
    try {
      await prisma.auditLog.create({ data: { ...outcome, entityType: BUYER_NOTICE_ENTITY_TYPE, entityId: sessionId } })
    } catch {
      // The claim stays without outcome: « in doubt », never retried automatically (the idempotency key covers 24 h).
      console.error("[unallocated-buyer-notice]", { metric: "outcome_not_recorded", sessionId, sent: result.ok })
    }
    return { status: result.ok ? "sent" : "failed", kind: plan.kind, attempt: plan.attempt, state: facts.state }
  } catch {
    console.error("[unallocated-buyer-notice]", { metric: "notice_error", sessionId })
    return { status: "session_unreadable" }
  }
}

/** Retry pass (cron): every session with a lost line in the last 30 days gets its due notice, failures included. */
export async function retryUnallocatedBuyerNotices(args: { now?: Date; limit?: number } = {}): Promise<{ disabled: boolean; examined: number; byStatus: Record<string, number> }> {
  if (!isBuyerNoticeEnabled()) return { disabled: true, examined: 0, byStatus: {} }
  const now = args.now ?? new Date()
  const traces = await prisma.auditLog.findMany({
    where: { action: UNALLOCATED_LINE_AUDIT_ACTION, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
    select: { entityId: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  })
  const sessions = [...new Set(traces.map((t) => t.entityId?.split(":line:")[0]).filter((s): s is string => Boolean(s)))].slice(0, args.limit ?? 50)
  const byStatus: Record<string, number> = {}
  for (const s of sessions) {
    const r = await notifyUnallocatedBuyer(s, { now })
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
  }
  return { disabled: false, examined: sessions.length, byStatus }
}
