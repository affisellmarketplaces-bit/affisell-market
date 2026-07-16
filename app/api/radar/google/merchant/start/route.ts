import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import {
  buildGoogleMerchantAuthorizeUrl,
  createGoogleMerchantOAuthState,
} from "@/lib/radar/connectors/google-merchant"
import { assertRadarRedisConfigured, gate } from "@/lib/radar/gate"

export async function GET(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const redisBlocked = assertRadarRedisConfigured()
  if (redisBlocked) return redisBlocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  try {
    const state = await createGoogleMerchantOAuthState(session.user.id)
    const url = buildGoogleMerchantAuthorizeUrl({ state })
    console.log("[radar/google/merchant/start]", { userId: session.user.id, result: "redirect" })
    return NextResponse.redirect(url)
  } catch (err) {
    console.error("[radar/google/merchant/start]", {
      userId: session.user.id,
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("REDIS_URL") || msg.includes("GOOGLE_CLIENT")) {
      return NextResponse.redirect(new URL("/radar/connect?error=oauth_start", req.url))
    }
    return NextResponse.redirect(new URL("/radar/connect?error=oauth_start", req.url))
  }
}
