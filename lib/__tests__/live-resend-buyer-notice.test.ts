import { describe, expect, it, vi } from "vitest"

/**
 * LIVE check of the buyer notice against the REAL Resend API — not a mock. Skipped unless AFFISELL_LIVE_RESEND=1.
 * Run only by `.github/workflows/resend-live-probe.yml` (manual), with a Resend TEST key and the sandbox sender.
 *
 * What it proves, with Resend's own answers:
 *  1. a first send under an idempotency key returns an e-mail id;
 *  2. the SAME key + SAME payload returns the SAME id (Resend deduplicated it — the recovery path relies on this);
 *  3. the SAME key + a DIFFERENT payload is refused with `invalid_idempotent_request` (never a second e-mail);
 *  4. optionally (REPLAY_KEY + REPLAY_ID from an earlier run): how long Resend keeps a key. The app re-sends a claim
 *     without outcome under the same key for up to 20 h (BUYER_NOTICE_RECOVERY_MS), so a replay 18–20 h later MUST
 *     still return the same id; a replay ≥ 24 h 5 min later is expected to send anew (Resend documents 24 h);
 *  5. every language / state is delivered to TEST_EMAIL_TO for a visual check in Gmail / Outlook.
 *
 * Safety: refuses to run unless the sender is Resend's sandbox AND TEST_EMAIL_TO is set, never with VERCEL_ENV=production,
 * and BEFORE EVERY SEND asks the app's own recipient resolver where the e-mail would go: anything but TEST_EMAIL_TO
 * aborts. The nominal recipient is on the reserved `.invalid` domain (RFC 2606: undeliverable by definition). No
 * database, no Stripe (both replaced by empty stubs): no real buyer can be read, let alone written to.
 */
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({}) }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: async () => undefined }))
vi.mock("@/lib/emails/email-brand.server", async () => {
  const shared = await import("@/lib/emails/email-brand-shared")
  return { resolveEmailBrandForAffiliate: async () => shared.PLATFORM_EMAIL_BRAND }
})

const LIVE = process.env.AFFISELL_LIVE_RESEND === "1"

describe.skipIf(!LIVE)("buyer notice — live Resend idempotency (sandbox sender, TEST_EMAIL_TO only)", () => {
  it("dedupes the same key + payload, refuses the same key with another payload, delivers every language", async () => {
    const { render } = await import("@react-email/render")
    const { UnallocatedLineNoticeEmail } = await import("@/emails/unallocated-line-notice")
    const { buildNoticeCopy } = await import("@/lib/unallocated-buyer-notice.server")
    const { readResendDeliveryConfig, sendResendEmail } = await import("@/lib/emails/resend-delivery")
    const { isProductionEmailDelivery, isResendSandboxFrom, resolveResendRecipient } = await import("@/lib/emails/resolve-resend-recipient")
    const { PLATFORM_EMAIL_BRAND, toEmailBrandProps } = await import("@/lib/emails/email-brand-shared")

    const config = readResendDeliveryConfig()
    expect(config, "RESEND_API_KEY missing").not.toBeNull()
    expect(isProductionEmailDelivery(), "never against production").toBe(false)
    expect(isResendSandboxFrom(config!.from), "sender must be onboarding@resend.dev").toBe(true)
    expect(config!.testEmailTo.trim(), "TEST_EMAIL_TO missing").not.toBe("")

    const html = async (locale: Parameters<typeof buildNoticeCopy>[0], kind: "initial" | "refund_confirmed", state: Parameters<typeof buildNoticeCopy>[2]) => {
      const { subject, copy } = buildNoticeCopy(locale, kind, state, "36,00 €")
      return { subject, html: await render(UnallocatedLineNoticeEmail({ copy, supportUrl: "https://affisell.com/support", brand: toEmailBrandProps(PLATFORM_EMAIL_BRAND) })) }
    }
    const NOMINAL = "no-real-buyer@affisell-probe.invalid"
    const testInbox = config!.testEmailTo.trim().toLowerCase()
    const send = (subject: string, body: string, idempotencyKey: string) => {
      // Fail closed: where would the APP send this? Anything but the team test inbox stops the run before Resend is called.
      const route = resolveResendRecipient({ intendedTo: NOMINAL, fromEmail: config!.from, testEmailTo: config!.testEmailTo })
      if (route.to !== testInbox || !route.devRedirect) throw new Error("recipient_not_redirected_to_test_inbox — nothing sent")
      return sendResendEmail({ context: "live-resend-probe", config: config!, intendedTo: NOMINAL, subject: `[TEST Affisell] ${subject}`, html: body, idempotencyKey })
    }

    // The key carries its creation time (minute precision) so a later run can tell how old a replayed key is.
    const key = `affisell-live-probe:${new Date().toISOString().slice(0, 16)}:${Math.random().toString(36).slice(2, 10)}`
    const a = await html("fr", "initial", "not_triggered")
    const first = await send(a.subject, a.html, key)
    // Resend's error CODE only: a provider message can echo the recipient.
    console.log("[live-resend] first send", { ok: first.ok, id: first.ok ? first.resendId : null, error: first.ok ? null : first.errorName ?? "provider_error" })
    expect(first.ok).toBe(true)

    const replay = await send(a.subject, a.html, key)
    console.log("[live-resend] same key + same payload", { ok: replay.ok, id: replay.ok ? replay.resendId : null, sameId: replay.ok && first.ok && replay.resendId === first.resendId })
    expect(replay.ok).toBe(true)
    expect(replay.ok && first.ok && replay.resendId).toBe(first.ok ? first.resendId : "")

    const other = await send(`${a.subject} (autre contenu)`, a.html, key)
    console.log("[live-resend] same key + other payload", { ok: other.ok, errorName: other.ok ? null : other.errorName ?? null })
    expect(other.ok).toBe(false)
    expect(other.ok ? null : other.errorName).toBe("invalid_idempotent_request")

    const replayKey = process.env.REPLAY_KEY?.trim()
    const replayId = process.env.REPLAY_ID?.trim()
    if (replayKey && replayId) {
      const created = /^affisell-live-probe:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}):/.exec(replayKey)?.[1]
      expect(created, "REPLAY_KEY must be a key printed by this probe").toBeTruthy()
      const ageH = (Date.now() - Date.parse(`${created}:00Z`)) / 3_600_000
      if (ageH >= 18 && ageH <= 20) {
        // The window the app relies on: a recovery up to 20 h after the claim must still be deduplicated.
        const again = await send(a.subject, a.html, replayKey)
        console.log("[live-resend] replay inside the app's recovery window", { ageH: ageH.toFixed(1), ok: again.ok, sameId: again.ok && again.resendId === replayId, error: again.ok ? null : again.errorName ?? "provider_error" })
        expect(again.ok && again.resendId, "Resend must still dedupe at 18–20 h, or the app's 20 h recovery could send twice").toBe(replayId)
      } else if (ageH >= 24 + 5 / 60) {
        const again = await send(a.subject, a.html, replayKey)
        console.log("[live-resend] replay after Resend's documented 24 h", { ageH: ageH.toFixed(1), ok: again.ok, newId: again.ok && again.resendId !== replayId })
        expect(again.ok, "a key past its window is accepted again").toBe(true)
      } else {
        console.log(`[live-resend] replay skipped: key is ${ageH.toFixed(1)} h old (meaningful at 18–20 h, or after 24 h 5 min)`)
      }
    }

    // Visual check: every language (first notice) + every refund state in French and English.
    const locales = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const
    const cases = [
      ...locales.map((l) => [l, "initial", "not_triggered"] as const),
      ...(["fr", "en"] as const).flatMap((l) => [[l, "initial", "requested"], [l, "initial", "in_progress"], [l, "initial", "confirmed"], [l, "refund_confirmed", "confirmed"]] as const),
    ]
    for (const [locale, kind, state] of cases) {
      const m = await html(locale, kind, state)
      const r = await send(`${locale} ${kind} ${state} — ${m.subject}`, m.html, `${key}:visual:${locale}:${kind}:${state}`)
      expect(r.ok, `${locale} ${kind} ${state}`).toBe(true)
    }
    console.log(`[live-resend] key=${key} first_id=${first.ok ? first.resendId : "-"} — keep both to re-run with REPLAY_KEY / REPLAY_ID after 24 h`)
  }, 120_000)
})
