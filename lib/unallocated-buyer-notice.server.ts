import "server-only"

import { render } from "@react-email/render"

import { UnallocatedLineNoticeEmail, type UnallocatedLineNoticeCopy } from "@/emails/unallocated-line-notice"
import { applyBrandToText, buildBrandedFrom, buyerEmailLinks, toEmailBrandProps } from "@/lib/emails/email-brand-shared"
import { resolveEmailBrandForAffiliate } from "@/lib/emails/email-brand.server"
import { interpolate } from "@/lib/emails/email-copy-utils"
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"
import { resolveEmailLocale } from "@/lib/emails/resolve-email-locale"
import { isProductionEmailDelivery, isResendSandboxFrom } from "@/lib/emails/resolve-resend-recipient"
import { tMessage } from "@/lib/i18n-pick-message"
import type { AppLocale } from "@/lib/i18n-locale"
import { intlLocaleTag } from "@/lib/i18n-ui-locale"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"
import { resolvePublicAppUrl } from "@/lib/public-app-url"
import { getStripeClient } from "@/lib/stripe"
import {
  awaitsInitialNotice,
  BUYER_NOTICE_CLAIM_ACTION,
  BUYER_NOTICE_DOUBT_ALERT_ACTION,
  BUYER_NOTICE_ENTITY_TYPE,
  BUYER_NOTICE_FAILED_ACTION,
  BUYER_NOTICE_SENT_ACTION,
  buyerNoticeMode,
  claimId,
  isNoticeComplete,
  lineRefundState,
  noticeCopyKey,
  planBuyerNotice,
  sessionRefundState,
  unexplainedRefunds,
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
type PaymentRefundLister = (paymentIntentId: string) => Promise<Array<{ id: string; status?: string | null; metadata?: Record<string, string> | null }> | null>

/** Stripe's status of a refund, `null` when it can not be read (the line then counts as `requested`, never more). */
export const readStripeRefundStatus: RefundStatusReader = async (refundId) => {
  try {
    const refund = await getStripeClient().refunds.retrieve(refundId)
    return typeof refund.status === "string" ? refund.status : null
  } catch {
    return null
  }
}

/** The refunds Stripe holds for the payment, `null` when they can not be read. */
export const listStripePaymentRefunds: PaymentRefundLister = async (paymentIntentId) => {
  try {
    const page = await getStripeClient().refunds.list({ payment_intent: paymentIntentId, limit: 100 })
    return page.data.map((r) => ({ id: r.id, status: r.status ?? null, metadata: (r.metadata ?? null) as Record<string, string> | null }))
  } catch {
    return null
  }
}

/**
 * The lost lines of one checkout session and the REAL state of their refund. Reads only. A « not issued » state is
 * double-checked against the payment's refunds: one that no fact explains (or refunds that can not be read) makes the
 * session `uncertain` — the buyer may already have been paid back by hand.
 */
export async function loadUnallocatedSessionFacts(
  sessionId: string,
  readStatus: RefundStatusReader = readStripeRefundStatus,
  listRefunds: PaymentRefundLister = listStripePaymentRefunds
): Promise<UnallocatedSessionFacts> {
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
  let paymentIntentId: string | null = null
  for (const [key, p] of traces) {
    const refundId = refundIds.get(key) ?? null
    states.push(lineRefundState(refundId, refundId ? await readStatus(refundId) : null))
    if (typeof p.refundableCents === "number" && Number.isInteger(p.refundableCents) && p.refundableCents > 0) amountCents += p.refundableCents
    if (typeof p.currency === "string" && p.currency) currency = p.currency
    if (!affiliateProductId && typeof p.affiliateProductId === "string") affiliateProductId = p.affiliateProductId
    if (!paymentIntentId && typeof p.paymentIntentId === "string" && p.paymentIntentId) paymentIntentId = p.paymentIntentId
  }
  let state = sessionRefundState(states)
  if (traces.size > 0 && state === "not_triggered") {
    const refunds = paymentIntentId ? await listRefunds(paymentIntentId) : null
    if (!refunds || unexplainedRefunds(refunds, new Set(refundIds.values())) > 0) state = "uncertain"
  }
  return { lines: traces.size, state, amountCents, currency, affiliateProductId }
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

/** Everything that decides the e-mail's bytes, stored in the claim so a recovery re-sends the SAME payload. */
type ClaimSnapshot = { kind: NoticeKind; attempt: number; state: RefundState; locale: AppLocale; amountCents: number; currency: string; affiliateId: string | null }

function readSnapshot(payload: unknown): ClaimSnapshot | null {
  const p = (payload ?? {}) as Record<string, unknown>
  if ((p.kind !== "initial" && p.kind !== "refund_confirmed") || typeof p.attempt !== "number" || typeof p.state !== "string" || typeof p.locale !== "string") return null
  if (typeof p.amountCents !== "number" || typeof p.currency !== "string") return null
  return { kind: p.kind, attempt: p.attempt, state: p.state as RefundState, locale: resolveEmailLocale(p.locale), amountCents: p.amountCents, currency: p.currency, affiliateId: typeof p.affiliateId === "string" ? p.affiliateId : null }
}

async function renderNotice(snap: ClaimSnapshot): Promise<{ subject: string; html: string; from: (base: string) => string }> {
  const brand = await resolveEmailBrandForAffiliate(snap.affiliateId)
  const supportUrl = buyerEmailLinks(brand, resolvePublicAppUrl()).support("").replace(/\?order=$/, "")
  const { subject, copy } = buildNoticeCopy(snap.locale, snap.kind, snap.state, formatAmount(snap.amountCents, snap.currency, snap.locale))
  const branded = Object.fromEntries(Object.entries(copy).map(([k, v]) => [k, applyBrandToText(v, brand)])) as UnallocatedLineNoticeCopy
  const html = await render(UnallocatedLineNoticeEmail({ copy: branded, supportUrl, brand: toEmailBrandProps(brand) }))
  return { subject: applyBrandToText(subject, brand), html, from: (base) => buildBrandedFrom(base, brand) }
}

export type NoticeResult =
  | { status: "disabled" | "no_lines" | "not_configured" | "preview_recipient_not_redirected" | "no_verified_recipient" | "session_unreadable" | "claimed_elsewhere" | "error" }
  | { status: "already_sent" | "nothing_new" | "in_flight" | "in_doubt" | "too_many_failures" | "uncertain_hold" }
  | { status: "shadow"; would: "send" | "recover"; kind: NoticeKind; attempt: number; state: RefundState }
  | { status: "sent" | "failed" | "recovered" | "recovery_conflict"; kind: NoticeKind; attempt: number; state: RefundState }

type SessionReader = (sessionId: string) => Promise<{ payment_status?: string | null; customer_details?: { email?: string | null } | null; metadata?: Record<string, string> | null } | null>

type Deps = { now?: Date; readStatus?: RefundStatusReader; listRefunds?: PaymentRefundLister; retrieveSession?: SessionReader }

async function writeOutcome(id: string, action: string, sessionId: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    await prisma.auditLog.create({ data: { id, action, entityType: BUYER_NOTICE_ENTITY_TYPE, entityId: sessionId, payload: payload as never } })
    return true
  } catch {
    return false
  }
}

/** One alert per claim in doubt, then silence (the alert row is the claim). */
async function alertDoubtOnce(sessionId: string, kind: NoticeKind, attempt: number, why: string): Promise<void> {
  const claim = claimId(sessionId, kind, attempt)
  if (!(await writeOutcome(`${claim}:alerted`, BUYER_NOTICE_DOUBT_ALERT_ACTION, sessionId, { kind, attempt, why }))) return
  await opsWebhookAlert(
    `[Affisell] Buyer notice IN DOUBT session=${sessionId} kind=${kind} attempt=${attempt} (${why}). It may or may not have been sent: ` +
      `check Resend's logs for the idempotency key « ${claim} », then record the outcome with ` +
      `POST /api/admin/unallocated-buyer-notices/resolve { sessionId, kind, attempt, outcome: "sent" | "failed" }. Nothing is re-sent automatically.`
  ).catch(() => undefined)
}

/**
 * Sends (or recovers) the next due notice of one checkout session, at most once per kind. `UNALLOCATED_LINE_BUYER_EMAIL`:
 * off = nothing at all, `shadow` = computed and logged only, `true` = sent. Never throws.
 */
export async function notifyUnallocatedBuyer(sessionId: string, deps: Deps = {}): Promise<NoticeResult> {
  const mode = buyerNoticeMode()
  if (mode === "off") return { status: "disabled" }
  const now = deps.now ?? new Date()
  try {
    const rows: NoticeRow[] = await prisma.auditLog.findMany({
      where: { id: { startsWith: `unallocated-buyer-notice:${sessionId}:` } },
      select: { id: true, action: true, createdAt: true, payload: true },
      take: 50,
    })
    if (isNoticeComplete(sessionId, rows)) return { status: "already_sent" } // no Stripe read for finished sessions
    const facts = await loadUnallocatedSessionFacts(sessionId, deps.readStatus, deps.listRefunds)
    if (facts.lines === 0) return { status: "no_lines" }
    const plan = planBuyerNotice(sessionId, facts.state, rows, now)
    if (plan.action === "none") {
      if (plan.reason === "in_doubt" && plan.kind && plan.attempt && mode === "on") await alertDoubtOnce(sessionId, plan.kind, plan.attempt, "older_than_recovery_window")
      return { status: plan.reason }
    }
    const config = readResendDeliveryConfig()
    if (!config && mode === "on") return { status: "not_configured" }
    // Outside production a VERIFIED sender delivers to the real buyer: only the sandbox sender + TEST_EMAIL_TO (every
    // mail redirected to the team) may send there. Checked before any claim, so nothing is consumed.
    if (mode === "on" && !isProductionEmailDelivery() && !(isResendSandboxFrom(config!.from) && config!.testEmailTo.trim())) {
      return { status: "preview_recipient_not_redirected" }
    }

    let session: Awaited<ReturnType<SessionReader>>
    try {
      session = deps.retrieveSession ? await deps.retrieveSession(sessionId) : await getStripeClient().checkout.sessions.retrieve(sessionId)
    } catch {
      return { status: "session_unreadable" }
    }
    const to = verifiedRecipient(session)
    if (!to) return { status: "no_verified_recipient" }

    let snap: ClaimSnapshot
    if (plan.action === "recover") {
      const stored = readSnapshot(plan.claimed.payload)
      if (!stored) {
        if (mode === "on") await alertDoubtOnce(sessionId, plan.kind, plan.attempt, "claim_without_snapshot")
        return { status: "in_doubt" }
      }
      snap = stored
    } else {
      let affiliateId: string | null = null
      if (facts.affiliateProductId) {
        affiliateId = (await prisma.affiliateProduct.findUnique({ where: { id: facts.affiliateProductId }, select: { affiliateId: true } }).catch(() => null))?.affiliateId ?? null
      }
      snap = { kind: plan.kind, attempt: plan.attempt, state: facts.state, locale: resolveEmailLocale(session?.metadata?.locale), amountCents: facts.amountCents, currency: facts.currency, affiliateId }
    }

    if (mode === "shadow") {
      console.log("[unallocated-buyer-notice]", { metric: "shadow_would_send", sessionId, would: plan.action, kind: snap.kind, attempt: snap.attempt, state: snap.state, locale: snap.locale })
      return { status: "shadow", would: plan.action, kind: snap.kind, attempt: snap.attempt, state: snap.state }
    }

    // Claim BEFORE sending (fresh notice only): one deterministic row per attempt; a concurrent run hits the key and stops.
    const id = claimId(sessionId, snap.kind, snap.attempt)
    if (plan.action === "send" && !(await writeOutcome(id, BUYER_NOTICE_CLAIM_ACTION, sessionId, { ...snap }))) return { status: "claimed_elsewhere" }

    const rendered = await renderNotice(snap)
    const result = await sendResendEmail({
      context: "unallocated-buyer-notice",
      config: { ...config!, from: rendered.from(config!.from) },
      intendedTo: to,
      subject: rendered.subject,
      html: rendered.html,
      idempotencyKey: id,
    })
    const base = { kind: snap.kind, attempt: snap.attempt, state: snap.state }
    if (result.ok) {
      if (!(await writeOutcome(`${id}:sent`, BUYER_NOTICE_SENT_ACTION, sessionId, { resendId: result.resendId ?? null, recovered: plan.action === "recover" }))) {
        console.error("[unallocated-buyer-notice]", { metric: "outcome_not_recorded", sessionId, sent: true })
      }
      return { status: plan.action === "recover" ? "recovered" : "sent", ...base }
    }
    if (result.errorName === "invalid_idempotent_request" || result.errorName === "concurrent_idempotent_requests") {
      // Same key, other payload (or still in progress at Resend): never a second e-mail — a human decides.
      await alertDoubtOnce(sessionId, snap.kind, snap.attempt, result.errorName)
      return { status: "recovery_conflict", ...base }
    }
    await writeOutcome(`${id}:failed`, BUYER_NOTICE_FAILED_ACTION, sessionId, { error: result.error === "invalid_recipient" ? "invalid_recipient" : "provider_error" })
    return { status: "failed", ...base }
  } catch {
    console.error("[unallocated-buyer-notice]", { metric: "notice_error", sessionId })
    return { status: "error" }
  }
}

/** Retry pass (cron): sessions with a lost line in the last 30 days, unfinished ones only, those still owed a first notice first. */
export async function retryUnallocatedBuyerNotices(args: { now?: Date; limit?: number } = {}): Promise<{ mode: string; examined: number; byStatus: Record<string, number> }> {
  const mode = buyerNoticeMode()
  if (mode === "off") return { mode, examined: 0, byStatus: {} }
  const now = args.now ?? new Date()
  const since = new Date(now.getTime() - 30 * 86_400_000)
  const traces = await prisma.auditLog.findMany({
    where: { action: UNALLOCATED_LINE_AUDIT_ACTION, createdAt: { gte: since } },
    select: { entityId: true },
    orderBy: { createdAt: "asc" },
    take: 2000,
  })
  const notices: NoticeRow[] = await prisma.auditLog.findMany({
    where: { id: { startsWith: "unallocated-buyer-notice:" }, createdAt: { gte: since } },
    select: { id: true, action: true, createdAt: true, payload: true },
    take: 10_000,
  })
  const sessions = [...new Set(traces.map((t) => t.entityId?.split(":line:")[0]).filter((s): s is string => Boolean(s)))]
  const open = sessions.filter((s) => !isNoticeComplete(s, notices))
  const ordered = [...open.filter((s) => awaitsInitialNotice(s, notices)), ...open.filter((s) => !awaitsInitialNotice(s, notices))].slice(0, args.limit ?? 50)
  const byStatus: Record<string, number> = {}
  for (const s of ordered) {
    const r = await notifyUnallocatedBuyer(s, { now })
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
  }
  return { mode, examined: ordered.length, byStatus }
}

/**
 * The human way out of a notice IN DOUBT, after looking at Resend's logs for its idempotency key: records `sent` or
 * `failed` for that attempt (a `failed` lets the next run send attempt n+1). Sends nothing. Audited.
 */
export async function resolveBuyerNoticeInDoubt(args: { sessionId: string; kind: NoticeKind; attempt: number; outcome: "sent" | "failed"; actorId: string; note?: string }): Promise<{ ok: true } | { ok: false; error: "claim_not_found" | "already_resolved" }> {
  const id = claimId(args.sessionId, args.kind, args.attempt)
  const claim = await prisma.auditLog.findUnique({ where: { id }, select: { id: true } })
  if (!claim) return { ok: false, error: "claim_not_found" }
  const done = await prisma.auditLog.findMany({ where: { id: { in: [`${id}:sent`, `${id}:failed`] } }, select: { id: true } })
  if (done.length > 0) return { ok: false, error: "already_resolved" }
  // One resolution per attempt, decided by the database: the `:resolved` row (deterministic primary key) and the outcome
  // row are written in ONE transaction, so two admins answering « sent » and « failed » at the same time can not both
  // win (found on a real PostgreSQL: the check above alone let both through). The parser ignores `:resolved`.
  try {
    await prisma.$transaction([
      prisma.auditLog.create({ data: { id: `${id}:resolved`, action: "payment.unallocated_line.buyer_notice.resolved", entityType: BUYER_NOTICE_ENTITY_TYPE, entityId: args.sessionId, actorId: args.actorId, payload: { outcome: args.outcome } } }),
      prisma.auditLog.create({
        data: {
          id: `${id}:${args.outcome}`,
          action: args.outcome === "sent" ? BUYER_NOTICE_SENT_ACTION : BUYER_NOTICE_FAILED_ACTION,
          entityType: BUYER_NOTICE_ENTITY_TYPE,
          entityId: args.sessionId,
          actorId: args.actorId,
          payload: { resolvedBy: args.actorId, note: args.note?.slice(0, 500) ?? null, manual: true },
        },
      }),
    ])
    return { ok: true }
  } catch {
    return { ok: false, error: "already_resolved" }
  }
}
