import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import {
  CRON_FAILURE_BODY_MAX_CHARS,
  formatCronFailureAlert,
  parseCronFailureReport,
} from "@/lib/cron/notify-failure"
import { opsWebhookAlert } from "@/lib/ops-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Called by the GitHub Actions `if: failure()` step of a failed cron job (finalisation master doc, J1): posts one line to
 * the ops Slack / Discord channel through the webhook the app already owns (`lib/ops-webhook.ts`), so no webhook URL has to
 * be copied into GitHub secrets. NOT scheduled: it only runs when a job has already failed.
 *
 * `POST` with `Authorization: Bearer ${CRON_SECRET}` and a JSON body `{ workflow, job, route, runUrl }`. The body is
 * validated, size-bounded and neutralised (no `@channel` / `@here` / `<@user>` mention can be injected, `runUrl` must be a
 * github.com Actions run) — see `lib/cron/notify-failure.ts`.
 */
export async function POST(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const declared = Number(req.headers.get("content-length") ?? "0")
  if (Number.isFinite(declared) && declared > CRON_FAILURE_BODY_MAX_CHARS * 4) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 })
  }
  const text = await req.text()
  if (text.length > CRON_FAILURE_BODY_MAX_CHARS) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 })
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = parseCronFailureReport(raw)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const message = formatCronFailureAlert(parsed.report)
  console.error("[cron-failure]", parsed.report)
  if (process.env.SENTRY_DSN?.trim()) {
    try {
      Sentry.captureMessage(message, { level: "error", extra: { ...parsed.report } })
    } catch {
      // alerting must never fail the notification
    }
  }

  const delivered = await opsWebhookAlert(message).catch(() => ({ slack: false, discord: false }))
  return NextResponse.json({ ok: true, delivered })
}
