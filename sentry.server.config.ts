import * as Sentry from "@sentry/nextjs"

import { resolveSentryEnvironment } from "@/lib/runtime-environment"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  // VERCEL_ENV, not NODE_ENV: NODE_ENV is "production" on Preview too (finalisation master K1, lib/runtime-environment.ts).
  environment: resolveSentryEnvironment(),
  tracesSampleRate: dsn ? (process.env.NODE_ENV === "development" ? 0.2 : 0.05) : 0,
})
