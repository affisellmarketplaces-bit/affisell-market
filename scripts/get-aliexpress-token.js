#!/usr/bin/env node
/**
 * Exchange an AliExpress OAuth authorization code for access/refresh tokens.
 * Tries DS REST /auth/token/create (signed) then legacy GET/POST /oauth/token.
 *
 * Usage:
 *   node --env-file=.env.local scripts/get-aliexpress-token.js <authorization_code>
 */

const crypto = require("node:crypto")

const OAUTH_TOKEN_URL = "https://api-sg.aliexpress.com/oauth/token"
const REST_CREATE = "https://api-sg.aliexpress.com/rest/auth/token/create"
const DEFAULT_REDIRECT =
  "https://affisell-market.vercel.app/api/aliexpress/oauth/callback"

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function signMd5(params, appSecret) {
  const keys = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
  let base = appSecret
  for (const key of keys) base += key + params[key]
  base += appSecret
  return crypto.createHash("md5").update(base, "utf8").digest("hex").toUpperCase()
}

function signSha256(apiPath, params, appSecret) {
  const keys = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
  let base = apiPath
  for (const key of keys) base += key + params[key]
  return crypto.createHmac("sha256", appSecret).update(base, "utf8").digest("hex").toUpperCase()
}

function extractTokens(json) {
  let nested = json
  if (json && typeof json.gopResponseBody === "string") {
    try {
      nested = JSON.parse(json.gopResponseBody)
    } catch {
      /* keep */
    }
  }
  nested = nested?.token_result || nested?.data || nested
  const access = nested?.access_token || nested?.accessToken
  const refresh = nested?.refresh_token || nested?.refreshToken
  return { access, refresh, nested }
}

async function tryFetch(label, url, init) {
  console.log(`\n→ ${label}\n  ${url.split("?")[0]}`)
  const res = await fetch(url, init)
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  console.log(`  HTTP ${res.status}`)
  console.log(text.slice(0, 2000))
  return { res, text, json }
}

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

  const oauthQuery = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  })

  const attempts = []

  // 1) REST create md5
  {
    const params = {
      app_key: clientId,
      code,
      sign_method: "md5",
      timestamp: formatTimestamp(),
    }
    params.sign = signMd5(params, clientSecret)
    const url = `${REST_CREATE}?${new URLSearchParams(params)}`
    attempts.push(await tryFetch("GET rest/auth/token/create md5", url, { method: "GET" }))
    const t = extractTokens(attempts.at(-1).json)
    if (t.access) return printSuccess(t)
  }

  // 2) REST create sha256
  {
    const params = {
      app_key: clientId,
      code,
      sign_method: "sha256",
      timestamp: formatTimestamp(),
    }
    params.sign = signSha256("/auth/token/create", params, clientSecret)
    const url = `${REST_CREATE}?${new URLSearchParams(params)}`
    attempts.push(await tryFetch("GET rest/auth/token/create sha256", url, { method: "GET" }))
    const t = extractTokens(attempts.at(-1).json)
    if (t.access) return printSuccess(t)
  }

  // 3) GET oauth/token
  {
    attempts.push(
      await tryFetch("GET oauth/token", `${OAUTH_TOKEN_URL}?${oauthQuery}`, { method: "GET" })
    )
    const t = extractTokens(attempts.at(-1).json)
    if (t.access) return printSuccess(t)
  }

  // 4) POST oauth/token
  {
    attempts.push(
      await tryFetch("POST oauth/token", OAUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: oauthQuery,
      })
    )
    const t = extractTokens(attempts.at(-1).json)
    if (t.access) return printSuccess(t)
  }

  console.error("\n[get-aliexpress-token] All methods failed")
  process.exit(2)
}

function printSuccess(t) {
  console.log("\n=== Paste into Vercel / .env.local ===\n")
  console.log(`ALIEXPRESS_ACCESS_TOKEN=${t.access}`)
  console.log(`ALIEXPRESS_REFRESH_TOKEN=${t.refresh || ""}`)
  console.log("\n=== Nested JSON ===\n")
  console.log(JSON.stringify(t.nested, null, 2))
}

main().catch((err) => {
  console.error("[get-aliexpress-token]", err)
  process.exit(1)
})
