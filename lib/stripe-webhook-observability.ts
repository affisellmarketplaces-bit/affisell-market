import * as Sentry from "@sentry/nextjs"
import Stripe from "stripe"

export function logStripeJson(payload: Record<string, unknown>) {
  console.log(JSON.stringify(payload))
}

export function logStripeWebhookInfo(payload: Record<string, unknown>) {
  logStripeJson({ level: "info", ...payload })
}

export function logStripeWebhookError(payload: Record<string, unknown>) {
  logStripeJson({ level: "error", ...payload })
}

export function captureStripeWebhookException(
  error: unknown,
  context: Record<string, unknown>
) {
  const stripeErr = error instanceof Stripe.errors.StripeError ? error : null

  logStripeWebhookError({
    ...context,
    errorCode: stripeErr?.code ?? (error instanceof Error ? error.name : "unknown"),
    param: stripeErr?.param ?? null,
    message: error instanceof Error ? error.message : String(error),
  })

  if (process.env.SENTRY_DSN?.trim()) {
    Sentry.captureException(error, { extra: context })
  }
}

export function stripeErrorFields(error: unknown) {
  if (error instanceof Stripe.errors.StripeError) {
    const raw = error.raw as { account?: string } | undefined
    return {
      errorCode: error.code ?? error.type,
      param: error.param ?? null,
      accountId: typeof raw?.account === "string" ? raw.account : null,
    }
  }
  return { errorCode: null, param: null, accountId: null }
}

