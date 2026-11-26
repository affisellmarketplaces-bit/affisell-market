import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { consumeEmailVerification } from "@/lib/email-verification.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * The link of the verification e-mail (lib/email-verification.server.ts). Consumes the token (single use) and sends the
 * visitor to the sign-in page with the outcome in `email_verified=1|invalid|expired`. It never opens a session: opening
 * the link proves the address, not the password.
 */
export async function GET(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), {
    prefix: "auth-verify-email",
    limit: 20,
    windowMs: 15 * 60_000,
  })
  if (limited) return limited

  const url = new URL(req.url)
  const token = url.searchParams.get("token") ?? ""
  const result = await consumeEmailVerification(token)
  const target = new URL("/login", url.origin)
  target.searchParams.set("email_verified", result.ok ? "1" : result.reason)
  const res = NextResponse.redirect(target, 303)
  // The token is in this URL: keep it out of the Referer of the next page.
  res.headers.set("Referrer-Policy", "no-referrer")
  return res
}
