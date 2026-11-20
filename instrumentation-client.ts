import * as Sentry from "@sentry/nextjs"

import { resolveSentryEnvironment } from "@/lib/runtime-environment"

/** Client Sentry init — lives here (not `sentry.client.config.ts`) for Turbopack / Next 16. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  // Literal `process.env.X` reads only: Next inlines those into the browser bundle, a bare `process.env` object stays empty there.
  // NEXT_PUBLIC_VERCEL_ENV is inlined by next.config.ts. Preview must not be filed under "production" (finalisation master K1).
  environment: resolveSentryEnvironment({
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
  }),
  tracesSampleRate: dsn ? (process.env.NODE_ENV === "development" ? 0.2 : 0.05) : 0,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
