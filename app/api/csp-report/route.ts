import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * CSP Report-Only sink — browsers POST violation reports here.
 * No auth; tightly rate-limited; never echoes body back.
 */
export async function POST(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), {
    prefix: "csp-report",
    limit: 60,
    windowMs: 60_000,
  })
  if (limited) return limited

  try {
    const raw = await req.text()
    if (raw.length > 16_384) {
      return new NextResponse(null, { status: 204 })
    }
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    const report =
      parsed && typeof parsed === "object" && "csp-report" in (parsed as object)
        ? (parsed as { "csp-report": unknown })["csp-report"]
        : parsed
    const violated =
      report && typeof report === "object"
        ? String(
            (report as { "violated-directive"?: string; violatedDirective?: string })[
              "violated-directive"
            ] ??
              (report as { violatedDirective?: string }).violatedDirective ??
              "unknown"
          ).slice(0, 120)
        : "unknown"
    console.log("[csp-report]", { result: "received", violated })
  } catch {
    console.log("[csp-report]", { result: "parse_failed" })
  }

  return new NextResponse(null, { status: 204 })
}
