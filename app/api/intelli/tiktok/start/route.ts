import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { assertMarketIntelliApiEnabled } from "@/lib/market-intelli/gate"
import {
  TIKTOK_SHOP_SCOPES,
  buildTikTokAuthorizeUrl,
  createTikTokOAuthState,
} from "@/lib/market-intelli/tiktok-oauth"

export async function GET(req: Request) {
  const blocked = assertMarketIntelliApiEnabled()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  try {
    const state = await createTikTokOAuthState(session.user.id)
    const url = buildTikTokAuthorizeUrl({ state, scope: TIKTOK_SHOP_SCOPES })
    console.log("[intelli/tiktok/start]", { userId: session.user.id, result: "redirect" })
    return NextResponse.redirect(url)
  } catch (err) {
    console.error("[intelli/tiktok/start]", {
      userId: session.user.id,
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.redirect(new URL("/intelli/connect?error=oauth_start", req.url))
  }
}
