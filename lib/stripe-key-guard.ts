/**
 * A LIVE Stripe key never runs outside production (finalisation master K1).
 *
 * Why: nothing stopped a Vercel Preview (or a laptop whose `.env.local` holds production values) from building its Stripe client with
 * the production `sk_live_…` key. A Preview checkout would then charge a real card, open real Connect transfers and create real
 * Issuing cards — on a deployment whose database is a staging branch, so the money would have no matching order.
 *
 * Applied where the application's Stripe client is built (`lib/stripe.ts` → `getStripeClient`, the only constructor in `lib/` and
 * `app/`). The error and the log name the ENVIRONMENT and the key MODE — never any part of the key.
 *
 *     production (VERCEL_ENV=production, or NODE_ENV=production with no Vercel signal: the Railway worker)  → live key allowed
 *     preview / development / test / a laptop                                                              → live key REFUSED
 *
 * The only escape hatch is for a developer machine that deliberately probes live mode (`AFFISELL_ALLOW_LIVE_STRIPE_OUTSIDE_PRODUCTION=1`);
 * it is ignored on ANY Vercel deployment (`VERCEL` set), so it cannot re-open the hole on a Preview.
 *
 * Pure: no I/O, no `server-only` (tests and scripts can import it).
 */
import { resolveRuntimeEnvironment, type RuntimeEnvironment } from "@/lib/runtime-environment"

type EnvBag = Record<string, string | undefined>

export type StripeKeyMode = "live" | "test" | "unknown"

export const ALLOW_LIVE_STRIPE_VARIABLE = "AFFISELL_ALLOW_LIVE_STRIPE_OUTSIDE_PRODUCTION"

/** `live` for `sk_live_` / `rk_live_` (secret and restricted keys), `test` for `sk_test_` / `rk_test_`; anything else is `unknown`. */
export function classifyStripeKey(key: string | undefined | null): StripeKeyMode {
  const trimmed = key?.trim() ?? ""
  if (/^(sk|rk)_live_/.test(trimmed)) return "live"
  if (/^(sk|rk)_test_/.test(trimmed)) return "test"
  return "unknown"
}

export class StripeLiveKeyOutsideProductionError extends Error {
  readonly environment: RuntimeEnvironment

  constructor(environment: RuntimeEnvironment) {
    super(
      `[stripe-guard] A LIVE Stripe key was configured in a non-production environment (${environment}) and was refused: the Stripe client is ` +
        `not built. Put the Stripe TEST key in this environment's STRIPE_SECRET_KEY (Vercel → Environment Variables → Preview / Development), ` +
        `never the live one. The key itself is not shown.`
    )
    this.name = "StripeLiveKeyOutsideProductionError"
    this.environment = environment
  }
}

/** True when a live key is acceptable here. */
export function isLiveStripeKeyAllowed(env: EnvBag = process.env): boolean {
  if (resolveRuntimeEnvironment(env) === "production") return true
  // Developer machine only: never honoured on a Vercel deployment (Preview included).
  const onVercel = Boolean(env.VERCEL?.trim())
  return !onVercel && env[ALLOW_LIVE_STRIPE_VARIABLE]?.trim() === "1"
}

/** Throws `StripeLiveKeyOutsideProductionError` for a live key outside production; returns for everything else. Never prints the key. */
export function assertStripeKeyAllowed(key: string | undefined | null, env: EnvBag = process.env): void {
  if (classifyStripeKey(key) !== "live") return
  if (isLiveStripeKeyAllowed(env)) return
  const environment = resolveRuntimeEnvironment(env)
  console.error("[stripe-guard]", { result: "live_key_refused", environment })
  throw new StripeLiveKeyOutsideProductionError(environment)
}
