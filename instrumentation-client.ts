import * as Sentry from "@sentry/nextjs"

/** Client Sentry init — lives here (not `sentry.client.config.ts`) for Turbopack / Next 16. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: dsn ? (process.env.NODE_ENV === "development" ? 0.2 : 0.05) : 0,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
