#!/usr/bin/env node
/**
 * Exchange an AliExpress OAuth authorization code for access/refresh tokens.
 *
 * Usage:
 *   node --env-file=.env.local scripts/get-aliexpress-token.js <authorization_code>
 *
 * Env:
 *   ALIEXPRESS_APP_KEY
 *   ALIEXPRESS_APP_SECRET
 *   ALIEXPRESS_OAUTH_REDIRECT_URI (optional — defaults to production callback)
 */

const TOKEN_URL = "https://api-sg.aliexpress.com/oauth/token"
const DEFAULT_REDIRECT =
  "https://affisell-market.vercel.app/api/aliexpress/oauth/callback"

async function main() {
  const code = process.argv[2]?.trim()
  if (!code) {
    console.error("Usage: node --env-file=.env.local scripts/get-aliexpress-token.js <code>")
    process.exit(1)
  }

  const clientId = process.env.ALIEXPRESS_APP_KEY?.trim() || process.env.ALIEXPRESS_KEY?.trim()
  const clientSecret =
    process.env.ALIEXPRESS_APP_SECRET?.trim() ||
    process.env.ALIEXPRESS_SECRET?.trim() ||
    process.env.ALIEXPRESS_APPSECRET?.trim()
  const redirectUri = process.env.ALIEXPRESS_OAUTH_REDIRECT_URI?.trim() || DEFAULT_REDIRECT

  if (!clientId || !clientSecret) {
    console.error("Missing ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET in env")
    process.exit(1)
  }

  console.log("[get-aliexpress-token]", {
    redirect_uri: redirectUri,
    client_id: clientId,
    code_len: code.length,
  })

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  })

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  })

  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  if (!res.ok) {
    console.error("[get-aliexpress-token] HTTP", res.status)
    console.error(JSON.stringify(json, null, 2))
    process.exit(2)
  }

  const nested = json?.token_result || json?.data || json
  const access = nested?.access_token || nested?.accessToken
  const refresh = nested?.refresh_token || nested?.refreshToken

  if (!access) {
    console.error("[get-aliexpress-token] No access_token in response:")
    console.error(JSON.stringify(json, null, 2))
    process.exit(2)
  }

  console.log("\n=== Paste into Vercel / .env.local ===\n")
  console.log(`ALIEXPRESS_ACCESS_TOKEN=${access}`)
  console.log(`ALIEXPRESS_REFRESH_TOKEN=${refresh || ""}`)
  console.log("\n=== Full JSON ===\n")
  console.log(JSON.stringify(json, null, 2))
}

main().catch((err) => {
  console.error("[get-aliexpress-token]", err)
  process.exit(1)
})
