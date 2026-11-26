import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { analyticsConsentFromCookieHeader } from "@/lib/events/consent"
import { isLikelyBotUserAgent, readConversionEventsMode, sessionIdsOf, toServerEventInput } from "@/lib/events/ingest"
import { recordEvents } from "@/lib/events/record.server"
import { isBatchSizeAcceptable, MAX_BATCH_BYTES, parseClientBatch } from "@/lib/events/schema"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noContent = (why: string) => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store", "X-Affisell-Events": why } })

/**
 * Browser conversion events (S3, docs/CONVERSION-EVENTS-WIRING-PLAN.md). NOT wired: nothing in the app calls it, and
 * `CONVERSION_EVENTS_MODE` is off by default — the request is then answered without reading its body.
 *
 * Order of the checks is deliberate: switch → same site → rate limit → size → CONSENT (read from the cookie, never
 * from the body) → robot → parse. Without consent the body is never parsed and nothing is stored. Answers carry no
 * detail an outsider could use (204 or a bare error code).
 */
export async function POST(req: Request) {
  if (readConversionEventsMode() !== "on") return noContent("off")

  const forbidden = assertSameSiteRequestOrigin(req)
  if (forbidden) return forbidden

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), { prefix: "events-ip", limit: 60, windowMs: 60_000 })
  if (limited) return limited

  const declared = Number(req.headers.get("content-length") ?? "0")
  if (Number.isFinite(declared) && declared > MAX_BATCH_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 })

  if (!analyticsConsentFromCookieHeader(req.headers.get("cookie"))) return noContent("no_consent")
  if (isLikelyBotUserAgent(req.headers.get("user-agent"))) return noContent("robot")

  let text: string
  try {
    text = await req.text()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  if (!isBatchSizeAcceptable(Buffer.byteLength(text, "utf8"))) return NextResponse.json({ error: "too_large" }, { status: 413 })

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const batch = parseClientBatch(body)
  if (batch.envelopeError) return NextResponse.json({ error: batch.envelopeError }, { status: 400 })

  for (const sid of sessionIdsOf(batch.events)) {
    const perSession = await rateLimitResponseAsync(`session:${sid}`, { prefix: "events-session", limit: 120, windowMs: 60 * 60_000 })
    if (perSession) return perSession
  }

  const result = await recordEvents(batch.events.map(toServerEventInput), { analyticsConsent: true })
  if (result.error) console.log("[events] ingest", { result: result.error })
  return noContent("ok")
}
