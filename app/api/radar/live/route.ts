import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { aggregateRadarLiveEvents } from "@/lib/radar/live-aggregator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/radar/live — last 24h Globe events (sale | import | spike).
 * Poll every ~10s from the Globe page. Optional SSE via Accept: text/event-stream.
 */
export async function GET(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), {
    limit: 60,
    windowMs: 60_000,
    prefix: "radar-live",
  })
  if (limited) return limited

  const { events, source, countries } = await aggregateRadarLiveEvents()
  const payload = {
    ok: true as const,
    events,
    source,
    countries,
    refreshedAt: new Date().toISOString(),
  }

  const accept = req.headers.get("accept") ?? ""
  if (accept.includes("text/event-stream")) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: live\ndata: ${JSON.stringify(payload)}\n\n`)
        )
        controller.close()
      },
    })
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    })
  }

  return NextResponse.json(payload)
}
