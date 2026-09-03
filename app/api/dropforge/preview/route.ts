import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import {
  previewDropForgeImport,
  resellerImportPreviewJson,
} from "@/lib/supplier-dropforge-import.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * DropForge B2B preview — public (supplier acquisition magnet).
 * Same scrape pipeline as legacy affiliate preview.
 */
export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), {
    limit: userId ? 60 : 30,
    windowMs: 60 * 60 * 1000,
    prefix: "dropforge-preview",
  })
  if (limited) return limited

  const body = (await req.json().catch(() => ({}))) as { url?: string }
  const url = typeof body.url === "string" ? body.url : ""

  const result = await previewDropForgeImport(url)
  if (!result.ok) {
    console.log("[dropforge]", {
      stage: "preview",
      result: "error",
      status: result.status,
      marketplaceLabel: result.marketplaceLabel,
      useBrowserCapture: result.useBrowserCapture,
      oauthReconnect: Boolean(result.oauthReconnectUrl),
    })
    return NextResponse.json(
      {
        error: result.error,
        marketplaceLabel: result.marketplaceLabel,
        useBrowserCapture: result.useBrowserCapture === true,
        oauthReconnectUrl: result.oauthReconnectUrl ?? null,
      },
      { status: result.status }
    )
  }

  console.log("[dropforge]", {
    stage: "preview",
    result: "ok",
    platform: result.preview.platform,
    method: result.preview.method,
    fulfillmentReady: result.preview.fulfillmentReady,
  })

  return NextResponse.json({
    ok: true,
    preview: resellerImportPreviewJson(result.preview),
  })
}
