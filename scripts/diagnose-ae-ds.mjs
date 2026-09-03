#!/usr/bin/env node
/**
 * Diagnose AliExpress DS product.get — standalone (no @/ imports).
 * Usage: node --env-file=.env.local scripts/diagnose-ae-ds.mjs [productId]
 */
import crypto from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadEnv(name) {
  if (existsSync(resolve(process.cwd(), name))) {
    for (const line of readFileSync(resolve(process.cwd(), name), "utf8").split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const eq = t.indexOf("=")
      if (eq <= 0) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1)
      if (process.env[k] === undefined) process.env[k] = v
    }
  }
}
for (const f of [".env", ".env.local"]) loadEnv(f)

const productId = process.argv[2]?.trim() || "1005008719608144"
const appKey = process.env.ALIEXPRESS_APP_KEY?.trim() || process.env.ALIEXPRESS_KEY?.trim()
const appSecret =
  process.env.ALIEXPRESS_APP_SECRET?.trim() ||
  process.env.ALIEXPRESS_SECRET?.trim() ||
  process.env.ALIEXPRESS_APPSECRET?.trim()
const accessToken =
  process.env.ALIEXPRESS_ACCESS_TOKEN?.trim() ||
  process.env.ALIEXPRESS_TOKEN?.trim() ||
  process.env.ALIEXPRESS_SESSION?.trim()

if (!appKey || !appSecret || !accessToken) {
  console.error("[diagnose-ae-ds] missing appKey/appSecret/accessToken in env")
  process.exit(1)
}

const HOSTS = [
  "https://api-sg.aliexpress.com/sync",
  "https://api.aliexpress.com/sync",
]

function signPayload(params, secret, mode) {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort()
  let payload = ""
  for (const key of sortedKeys) payload += key + params[key]
  if (mode === "md5-wrap") {
    const base = secret + payload + secret
    return crypto.createHash("md5").update(base, "utf8").digest("hex").toUpperCase()
  }
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex").toUpperCase()
}

function beijingTimestamp(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0")
  const d = String(shifted.getUTCDate()).padStart(2, "0")
  const h = String(shifted.getUTCHours()).padStart(2, "0")
  const min = String(shifted.getUTCMinutes()).padStart(2, "0")
  const s = String(shifted.getUTCSeconds()).padStart(2, "0")
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

function encodeQuery(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&")
}

const biz = {
  product_id: productId,
  target_currency: "EUR",
  ship_to_country: "FR",
  target_language: "FR",
}

const STRATEGIES = [
  {
    label: "sha256-query-empty",
    signMode: "sha256",
    timestamp: () => String(Date.now()),
    simplify: "true",
    transport: "query-empty",
  },
  {
    label: "sha256-post-form",
    signMode: "sha256",
    timestamp: () => String(Date.now()),
    simplify: "true",
    transport: "post-form",
  },
  {
    label: "sha256-no-simplify",
    signMode: "sha256",
    timestamp: () => String(Date.now()),
    simplify: null,
    transport: "query-empty",
  },
  {
    label: "md5-post-form",
    signMode: "md5-wrap",
    timestamp: beijingTimestamp,
    simplify: null,
    transport: "post-form",
  },
]

console.log("[diagnose-ae-ds]", {
  productId,
  appKey,
  aliexpressEnv: process.env.ALIEXPRESS_ENV ?? "(unset)",
  tokenTail: accessToken.slice(-4),
})

for (const host of HOSTS) {
  const hostLabel = host.includes("api-sg") ? "sg" : "global"
  for (const strat of STRATEGIES) {
    const label = `${hostLabel}/${strat.label}`
    const params = {
      method: "aliexpress.ds.product.get",
      app_key: appKey,
      session: accessToken,
      access_token: accessToken,
      sign_method: strat.signMode === "md5-wrap" ? "md5" : "sha256",
      timestamp: strat.timestamp(),
      format: "json",
      v: "2.0",
      ...biz,
    }
    if (strat.simplify) params.simplify = strat.simplify
    params.sign = signPayload(params, appSecret, strat.signMode)

    try {
      let res
      if (strat.transport === "query-empty") {
        res = await fetch(`${host}?${encodeQuery(params)}`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          },
          body: "",
        })
      } else {
        res = await fetch(host, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          },
          body: encodeQuery(params),
        })
      }
      const text = await res.text()
      let json
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        console.error(`[diagnose-ae-ds] FAIL ${label} non-json`, text.slice(0, 300))
        continue
      }
      const err = json?.error_response ?? (json?.type === "ISV" ? json : null)
      if (err) {
        console.error(`[diagnose-ae-ds] FAIL ${label}`, JSON.stringify(err).slice(0, 400))
        continue
      }
      const node =
        json?.aliexpress_ds_product_get_response ??
        json?.result ??
        json
      const subject =
        node?.result?.ae_item_base_info_dto?.subject ??
        node?.ae_item_base_info_dto?.subject ??
        node?.subject ??
        ""
      console.log(`[diagnose-ae-ds] OK ${label}`, {
        http: res.status,
        subject: String(subject).slice(0, 80),
        topKeys: Object.keys(json ?? {}).slice(0, 5),
      })
      console.log(JSON.stringify(json, null, 2).slice(0, 2500))
      process.exit(0)
    } catch (e) {
      console.error(`[diagnose-ae-ds] FAIL ${label}`, e instanceof Error ? e.message : e)
    }
  }
}
process.exit(1)
