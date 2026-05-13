/**
 * One-shot: load .env.local, send a test event to Sentry, flush.
 * Run: npx tsx scripts/verify-sentry.ts
 * Does not print the DSN.
 */
import { config } from "dotenv"
import { resolve } from "node:path"
import * as Sentry from "@sentry/node"

// Next.js only reads `.env*` at repo root — `prisma/env.local` is for Prisma CLI, not the app.
config({ path: resolve(process.cwd(), "prisma/env.local") })
config({ path: resolve(process.cwd(), ".env.local") })

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
if (!dsn?.trim()) {
  console.error("Missing SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN in .env.local")
  process.exit(1)
}

Sentry.init({
  dsn: dsn.trim(),
  environment: "verify-script",
})

void (async () => {
  const eventId = Sentry.captureMessage("Affisell Market — Sentry verify script", "info")
  const flushed = await Sentry.flush(10_000)

  if (!flushed) {
    console.error("Flush timed out — check network or Sentry ingest URL.")
    process.exit(1)
  }

  console.log("OK: event sent. event_id:", eventId)
  console.log(
    "Open your Sentry project → Issues and search for “verify script” or the event id above.",
  )
})()
