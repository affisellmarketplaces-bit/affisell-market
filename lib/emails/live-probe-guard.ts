import { isProductionEmailDelivery, isResendSandboxFrom, resolveResendRecipient } from "@/lib/emails/resolve-resend-recipient"

/**
 * Safety rules of the live Resend probe (`.github/workflows/resend-live-probe.yml`), kept apart from the test so they
 * are themselves unit-tested (`resend-live-probe-guard.test.ts`) without any network.
 *
 * The probe sends REAL e-mails through the app's own `sendResendEmail`, which chooses the recipient itself. These two
 * checks make the team test inbox the ONLY possible destination:
 *  - `assertProbeEnvironment`: refused in production (where the app would write to the real recipient), refused
 *    unless the sender is Resend's sandbox (Resend itself then only delivers to the account owner's address), refused
 *    without a well-formed TEST_EMAIL_TO;
 *  - `assertRoutesToTestInbox`: before EVERY send, asks the app's resolver where this e-mail would go; anything but the
 *    test inbox stops the run before Resend is called. `sendResendEmail`'s only other destination (its sandbox
 *    fallback) is the same test inbox, by construction (it retries `testEmailTo`, and only when the first attempt was
 *    NOT already the test inbox).
 */
export const PROBE_NOMINAL_RECIPIENT = "no-real-buyer@affisell-probe.invalid"

export function assertProbeEnvironment(config: { from: string; testEmailTo: string } | null): { from: string; testInbox: string } {
  if (!config) throw new Error("probe_refused: RESEND_API_KEY missing")
  if (isProductionEmailDelivery()) throw new Error("probe_refused: production environment")
  if (!isResendSandboxFrom(config.from)) throw new Error("probe_refused: sender is not Resend's sandbox")
  const testInbox = config.testEmailTo.trim().toLowerCase()
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(testInbox)) throw new Error("probe_refused: TEST_EMAIL_TO missing or malformed")
  return { from: config.from, testInbox }
}

export function assertRoutesToTestInbox(config: { from: string; testEmailTo: string }, intendedTo = PROBE_NOMINAL_RECIPIENT): void {
  const route = resolveResendRecipient({ intendedTo, fromEmail: config.from, testEmailTo: config.testEmailTo })
  if (!route.devRedirect || route.to !== config.testEmailTo.trim().toLowerCase()) {
    throw new Error("probe_refused: recipient not redirected to the test inbox — nothing sent")
  }
}
