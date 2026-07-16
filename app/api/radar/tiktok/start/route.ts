import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { assertRadarApiEnabled } from "@/lib/radar/gate"
import {
  TIKTOK_SHOP_SCOPES,
  buildTikTokAuthorizeUrl,
  createTikTokOAuthState,
} from "@/lib/radar/tiktok-oauth"

export async function GET(req: Request) {
  const blocked = assertRadarApiEnabled()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  try {
    const state = await createTikTokOAuthState(session.user.id)
    const url = buildTikTokAuthorizeUrl({ state, scope: TIKTOK_SHOP_SCOPES })
    console.log("[radar/tiktok/start]", { userId: session.user.id, result: "redirect" })
    return NextResponse.redirect(url)
  } catch (err) {
    console.error("[radar/tiktok/start]", {
      userId: session.user.id,
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.redirect(new URL("/radar/connect?error=oauth_start", req.url))
  }
}
