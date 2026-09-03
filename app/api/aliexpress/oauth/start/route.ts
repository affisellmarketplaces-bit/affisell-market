import { NextResponse } from "next/server"

import { readAliExpressConfig } from "@/lib/aliexpress-config"
import {
  buildAliExpressAuthorizeUrl,
  resolveAliExpressOAuthRedirectUri,
} from "@/lib/aliexpress-oauth-token-exchange"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/aliexpress/oauth/start
 * Redirects to AliExpress Open Platform authorize (DropForge / DS OAuth).
 * ?format=json → { authorizeUrl, redirectUri }
 */
export async function GET(req: Request) {
  const config = readAliExpressConfig()
  const redirectUri = resolveAliExpressOAuthRedirectUri()

  if (!config.appKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "ALIEXPRESS_APP_KEY missing on server",
        redirect_uri: redirectUri,
      },
      { status: 503 }
    )
  }

  const authorizeUrl = buildAliExpressAuthorizeUrl(config.appKey, redirectUri)
  const url = new URL(req.url)
  if (url.searchParams.get("format") === "json") {
    return NextResponse.json({
      ok: true,
      authorizeUrl,
      redirectUri,
      appKey: config.appKey,
    })
  }

  return NextResponse.redirect(authorizeUrl)
}
