import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  BUYER_NOTICE_CLAIM_ACTION,
  BUYER_NOTICE_FAILED_ACTION,
  BUYER_NOTICE_SENT_ACTION,
  buyerNoticeMode,
  claimId,
  isBuyerNoticeEnabled,
  isNoticeComplete,
  lineRefundState,
  mayMentionRefund,
  noticeCopyKey,
  planBuyerNotice,
  sessionRefundState,
  unexplainedRefunds,
  verifiedRecipient,
  type NoticeRow,
} from "@/lib/unallocated-buyer-notice"

const now = new Date("2026-11-17T12:00:00Z")
const ago = (min: number) => new Date(now.getTime() - min * 60_000)
const claim = (kind: "initial" | "refund_confirmed", n: number, state: string, at = ago(60)): NoticeRow => ({ id: claimId("cs", kind, n), action: BUYER_NOTICE_CLAIM_ACTION, createdAt: at, payload: { state } })
const sent = (kind: "initial" | "refund_confirmed", n: number): NoticeRow => ({ id: `${claimId("cs", kind, n)}:sent`, action: BUYER_NOTICE_SENT_ACTION, createdAt: ago(59), payload: {} })
const failed = (kind: "initial" | "refund_confirmed", n: number): NoticeRow => ({ id: `${claimId("cs", kind, n)}:failed`, action: BUYER_NOTICE_FAILED_ACTION, createdAt: ago(59), payload: {} })

describe("refund state — read from facts, never assumed", () => {
  it("per line", () => {
    expect(lineRefundState(null, null)).toBe("not_triggered")
    expect(lineRefundState("re_1", null)).toBe("requested") // created, status unreadable now
    expect(lineRefundState("re_1", "pending")).toBe("in_progress")
    expect(lineRefundState("re_1", "requires_action")).toBe("in_progress")
    expect(lineRefundState("re_1", "succeeded")).toBe("confirmed")
    expect(lineRefundState("re_1", "failed")).toBe("not_triggered")
    expect(lineRefundState("re_1", "canceled")).toBe("not_triggered")
  })
  it("a session is as far as its least advanced line", () => {
    expect(sessionRefundState(["confirmed", "in_progress"])).toBe("in_progress")
    expect(sessionRefundState(["confirmed", "not_triggered"])).toBe("not_triggered")
    expect(sessionRefundState(["confirmed", "confirmed"])).toBe("confirmed")
    expect(sessionRefundState([])).toBe("not_triggered")
  })
  it("no refund wording while nothing was issued", () => {
    expect(mayMentionRefund("not_triggered")).toBe(false)
    expect(noticeCopyKey("initial", "not_triggered")).toBe("notTriggered")
    expect(noticeCopyKey("refund_confirmed", "confirmed")).toBe("confirmed")
  })
})

describe("one notice per kind, no duplicate, failures retried, doubt left to a human", () => {
  it("first time: initial attempt 1", () => {
    expect(planBuyerNotice("cs", "not_triggered", [], now)).toEqual({ action: "send", kind: "initial", attempt: 1 })
  })
  it("a send in flight is not doubled; a claim without outcome is RECOVERED (same attempt, same key) for 20 h, then left to a human", () => {
    expect(planBuyerNotice("cs", "not_triggered", [claim("initial", 1, "not_triggered", ago(1))], now)).toEqual({ action: "none", reason: "in_flight" })
    expect(planBuyerNotice("cs", "not_triggered", [claim("initial", 1, "not_triggered", ago(30))], now)).toMatchObject({ action: "recover", kind: "initial", attempt: 1, claimed: { state: "not_triggered" } })
    expect(planBuyerNotice("cs", "not_triggered", [claim("initial", 1, "not_triggered", ago(21 * 60))], now)).toEqual({ action: "none", reason: "in_doubt", attempt: 1, kind: "initial" })
  })
  it("an unexplained refund on the payment holds a FRESH notice, but never a recovery of what was already claimed", () => {
    expect(planBuyerNotice("cs", "uncertain", [], now)).toEqual({ action: "none", reason: "uncertain_hold" })
    expect(planBuyerNotice("cs", "uncertain", [claim("initial", 1, "not_triggered", ago(30))], now)).toMatchObject({ action: "recover" })
  })
  it("a recorded failure is retried with the next attempt, up to the cap", () => {
    expect(planBuyerNotice("cs", "not_triggered", [claim("initial", 1, "x"), failed("initial", 1)], now)).toEqual({ action: "send", kind: "initial", attempt: 2 })
    const five = [1, 2, 3, 4, 5].flatMap((n) => [claim("initial", n, "x"), failed("initial", n)])
    expect(planBuyerNotice("cs", "not_triggered", five, now)).toEqual({ action: "none", reason: "too_many_failures" })
  })
  it("after the initial notice: nothing until the refund is confirmed, then ONE confirmation", () => {
    const initialSent = [claim("initial", 1, "not_triggered"), sent("initial", 1)]
    expect(planBuyerNotice("cs", "not_triggered", initialSent, now)).toEqual({ action: "none", reason: "nothing_new" })
    expect(planBuyerNotice("cs", "in_progress", initialSent, now)).toEqual({ action: "none", reason: "nothing_new" })
    expect(planBuyerNotice("cs", "confirmed", initialSent, now)).toEqual({ action: "send", kind: "refund_confirmed", attempt: 1 })
    expect(planBuyerNotice("cs", "confirmed", [...initialSent, claim("refund_confirmed", 1, "confirmed"), sent("refund_confirmed", 1)], now)).toEqual({ action: "none", reason: "already_sent" })
  })
  it("an initial notice that already said « confirmed » gets no second e-mail", () => {
    expect(planBuyerNotice("cs", "confirmed", [claim("initial", 1, "confirmed"), sent("initial", 1)], now)).toEqual({ action: "none", reason: "already_sent" })
  })
  it("rows of another session sharing a prefix are ignored", () => {
    const other: NoticeRow = { id: claimId("cs2", "initial", 1), action: BUYER_NOTICE_CLAIM_ACTION, createdAt: ago(1), payload: {} }
    expect(planBuyerNotice("cs", "not_triggered", [other], now)).toEqual({ action: "send", kind: "initial", attempt: 1 })
  })
})

describe("ambiguous refunds and finished sessions", () => {
  it("a refund is explained by a line proof or an app order refund; failed / canceled ones do not count", () => {
    const known = new Set(["re_line"])
    expect(unexplainedRefunds([{ id: "re_line", status: "succeeded" }, { id: "re_order", status: "succeeded", metadata: { orderId: "o1" } }], known)).toBe(0)
    expect(unexplainedRefunds([{ id: "re_dash", status: "succeeded", metadata: {} }], known)).toBe(1)
    expect(unexplainedRefunds([{ id: "re_x", status: "failed" }, { id: "re_y", status: "canceled" }], known)).toBe(0)
  })
  it("a session is finished once the confirmation went out, or the initial notice already said « confirmed »", () => {
    expect(isNoticeComplete("cs", [claim("initial", 1, "confirmed"), sent("initial", 1)])).toBe(true)
    expect(isNoticeComplete("cs", [claim("initial", 1, "not_triggered"), sent("initial", 1)])).toBe(false)
    expect(isNoticeComplete("cs", [claim("initial", 1, "not_triggered"), sent("initial", 1), claim("refund_confirmed", 1, "confirmed"), sent("refund_confirmed", 1)])).toBe(true)
  })
})

describe("recipient and switch", () => {
  it("only the address the payer gave Stripe for a PAID session", () => {
    expect(verifiedRecipient({ payment_status: "paid", customer_details: { email: " buyer@example.com " } })).toBe("buyer@example.com")
    expect(verifiedRecipient({ payment_status: "unpaid", customer_details: { email: "buyer@example.com" } })).toBeNull()
    expect(verifiedRecipient({ payment_status: "paid", customer_details: { email: "not-an-email" } })).toBeNull()
    expect(verifiedRecipient({ payment_status: "paid", customer_details: null })).toBeNull()
    expect(verifiedRecipient(null)).toBeNull()
  })
  it("rollout: off by default, `shadow` computes and logs only, `true` sends", () => {
    expect(buyerNoticeMode({})).toBe("off")
    expect(buyerNoticeMode({ UNALLOCATED_LINE_BUYER_EMAIL: "shadow" })).toBe("shadow")
    expect(buyerNoticeMode({ UNALLOCATED_LINE_BUYER_EMAIL: "true" })).toBe("on")
    expect(isBuyerNoticeEnabled({ UNALLOCATED_LINE_BUYER_EMAIL: "shadow" })).toBe(false)
  })
  it("off unless exactly `true`", () => {
    expect(isBuyerNoticeEnabled({})).toBe(false)
    expect(isBuyerNoticeEnabled({ UNALLOCATED_LINE_BUYER_EMAIL: "1" })).toBe(false)
    expect(isBuyerNoticeEnabled({ UNALLOCATED_LINE_BUYER_EMAIL: "true" })).toBe(true)
  })
})

describe("texts: 8 languages, same keys, no promise in the not-triggered sentence", () => {
  const locales = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]
  const load = (l: string) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as { emails: Record<string, unknown>; success: Record<string, unknown> }
  const keys = (o: unknown, p = ""): string[] => (o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [p])
  it("every language has exactly the French keys", () => {
    const ref = keys(load("fr").emails.unallocatedLine).sort()
    const refPage = keys(load("fr").success.unallocatedRefund).sort()
    for (const l of locales) {
      expect(keys(load(l).emails.unallocatedLine).sort(), l).toEqual(ref)
      expect(keys(load(l).success.unallocatedRefund).sort(), l).toEqual(refPage)
    }
  })
  it("the French not-triggered sentences never say « sera remboursé »", () => {
    const fr = load("fr")
    const email = (fr.emails.unallocatedLine as { refund: Record<string, string> }).refund.notTriggered
    const page = (fr.success.unallocatedRefund as Record<string, string>).notTriggered
    for (const s of [email, page, fr.success.unallocatedBody as string]) expect(s).not.toMatch(/sera rembours|vous sera rembours/)
  })
})
