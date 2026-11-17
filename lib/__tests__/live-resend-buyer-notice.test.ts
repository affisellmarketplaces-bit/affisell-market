import { describe, expect, it, vi } from "vitest"

/**
 * LIVE check of the buyer notice against the REAL Resend API — not a mock. Skipped unless AFFISELL_LIVE_RESEND=1.
 * Run only by `.github/workflows/resend-live-probe.yml` (manual), with a Resend TEST key and the sandbox sender.
 *
 * What it proves, with Resend's own answers:
 *  1. a first send under an idempotency key returns an e-mail id;
 *  2. the SAME key + SAME payload returns the SAME id (Resend deduplicated it — the recovery path relies on this);
 *  3. the SAME key + a DIFFERENT payload is refused with `invalid_idempotent_request` (never a second e-mail);
 *  4. optionally (REPLAY_KEY + REPLAY_ID from a run ≥ 24 h earlier): the key has EXPIRED (new id) — the retention window;
 *  5. every language / state is delivered to TEST_EMAIL_TO for a visual check in Gmail / Outlook.
 *
 * Safety: refuses to run unless the sender is Resend's sandbox AND TEST_EMAIL_TO is set (the production recipient
 * resolver then redirects every e-mail to that address — the same rule the app applies outside production), and it
 * never runs with VERCEL_ENV=production. No database, no Stripe: the e-mail is built by the production functions.
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
    const { isProductionEmailDelivery, isResendSandboxFrom } = await import("@/lib/emails/resolve-resend-recipient")
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
    const send = (subject: string, body: string, idempotencyKey: string) =>
      sendResendEmail({ context: "live-resend-probe", config: config!, intendedTo: "buyer-never-used@example.com", subject: `[TEST Affisell] ${subject}`, html: body, idempotencyKey })

    const key = `affisell-live-probe:${new Date().toISOString().slice(0, 10)}:${Math.random().toString(36).slice(2, 10)}`
    const a = await html("fr", "initial", "not_triggered")
    const first = await send(a.subject, a.html, key)
    console.log("[live-resend] first send", { ok: first.ok, id: first.ok ? first.resendId : null, error: first.ok ? null : first.errorName ?? first.error })
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
      const again = await send(a.subject, a.html, replayKey)
      console.log("[live-resend] key from an earlier run", { ok: again.ok, newId: again.ok && again.resendId !== replayId })
      expect(again.ok && again.resendId !== replayId, "a key older than the window must no longer dedupe").toBe(true)
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
