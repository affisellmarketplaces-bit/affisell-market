import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import {
  previewResellerUrlImport,
  resellerImportPreviewJson,
} from "@/lib/affiliate-url-import.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Preview scrape for reseller URL → boutique.
 * Guests allowed (conversion magnet) with IP rate limit; affiliates get higher quota.
 */
export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), {
    limit: userId ? 60 : 30,
    windowMs: 60 * 60 * 1000,
    prefix: "dropforge-import-url-preview",
  })
  if (limited) return limited

  const body = (await req.json().catch(() => ({}))) as { url?: string }
  const url = typeof body.url === "string" ? body.url : ""

  const result = await previewResellerUrlImport(url)
  if (!result.ok) {
    console.log("[affiliate-url-import]", {
      stage: "preview",
      result: "error",
      status: result.status,
      marketplaceLabel: result.marketplaceLabel,
    })
    return NextResponse.json(
      { error: result.error, marketplaceLabel: result.marketplaceLabel },
      { status: result.status }
    )
  }

  console.log("[affiliate-url-import]", {
    stage: "preview",
    result: "ok",
    platform: result.preview.platform,
    method: result.preview.method,
  })

  return NextResponse.json({
    ok: true,
    preview: resellerImportPreviewJson(result.preview),
  })
}
