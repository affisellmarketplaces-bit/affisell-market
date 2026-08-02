#!/usr/bin/env node
/**
 * Exchange an AliExpress OAuth authorization code for access/refresh tokens.
 *
 * Usage:
 *   node --env-file=.env.local scripts/get-aliexpress-token.js <authorization_code>
 */

const crypto = require("node:crypto")

const OAUTH_TOKEN_URL = "https://api-sg.aliexpress.com/oauth/token"
const REST_CREATE = "https://api-sg.aliexpress.com/rest/auth/token/create"
const DEFAULT_REDIRECT =
  "https://affisell-market.vercel.app/api/aliexpress/oauth/callback"

function beijingTs(d = new Date()) {
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  const p = (n) => String(n).padStart(2, "0")
  return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())} ${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}`
}

function msTs(d = new Date()) {
  return String(d.getTime())
}

function encodeQuery(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&")
}

function payload(params) {
  return Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
    .map((k) => k + params[k])
    .join("")
}

function signMd5(params, secret) {
  const base = secret + payload(params) + secret
  return crypto.createHash("md5").update(base, "utf8").digest("hex").toUpperCase()
}

function signIopSha256(apiPath, params, secret) {
  const base = apiPath + payload(params)
  return crypto.createHmac("sha256", secret).update(base, "utf8").digest("hex").toUpperCase()
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
  if (nested?.code && nested.code !== "0" && !nested.access_token) return { access: null }
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

  const variants = [
    { ts: msTs(), signMethod: "sha256", mode: "iop", http: "GET" },
    { ts: msTs(), signMethod: "sha256", mode: "iop", http: "POST" },
    { ts: beijingTs(), signMethod: "md5", mode: "md5", http: "GET" },
    { ts: beijingTs(), signMethod: "md5", mode: "md5", http: "POST" },
  ]

  for (const v of variants) {
    const params = {
      app_key: clientId,
      code,
      sign_method: v.signMethod,
      timestamp: v.ts,
    }
    params.sign =
      v.mode === "iop"
        ? signIopSha256("/auth/token/create", params, clientSecret)
        : signMd5(params, clientSecret)
    const body = encodeQuery(params)
    const label = `${v.http} create ${v.signMethod} ts=${v.ts}`
    const attempt =
      v.http === "POST"
        ? await tryFetch(label, REST_CREATE, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
              Accept: "application/json",
            },
            body,
          })
        : await tryFetch(label, `${REST_CREATE}?${body}`, { method: "GET" })
    const t = extractTokens(attempt.json)
    if (t.access) return printSuccess(t)
  }

  const oauth = encodeQuery({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  })
  for (const [label, url, init] of [
    ["GET oauth/token", `${OAUTH_TOKEN_URL}?${oauth}`, { method: "GET" }],
    [
      "POST oauth/token",
      OAUTH_TOKEN_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: oauth,
      },
    ],
  ]) {
    const attempt = await tryFetch(label, url, init)
    const t = extractTokens(attempt.json)
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
