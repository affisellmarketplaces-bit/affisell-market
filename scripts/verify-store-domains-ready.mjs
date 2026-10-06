#!/usr/bin/env node
/**
 * Pre-flight before merchant custom domain auto-SSL in prod.
 * Run: npm run verify:store-domains              (config + a REAL HTTPS check of the storefront wildcard)
 *      npm run verify:store-domains -- my-slug   (also checks that store's own host)
 *      npm run verify:store-domains -- --offline (config only, no network)
 *
 * The HTTPS check opens a real TLS connection, exactly like a browser. "Vercel says the domain is verified" is not
 * evidence that visitors can open it: a proxy in front (Cloudflare) ends TLS first, and its free certificate covers only
 * ONE label under the apex — `*.affisell.com`, not `{slug}.shops.affisell.com`.
 */
import { existsSync, readFileSync } from "node:fs"
import dns from "node:dns/promises"
import { resolve } from "node:path"
import tls from "node:tls"

function loadDotEnv(path) {
  if (!existsSync(path)) return
  const raw = readFileSync(path, "utf8")
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadDotEnv(resolve(process.cwd(), "prisma/env.local"))
loadDotEnv(resolve(process.cwd(), ".env.local"))

const checks = []
const ok = (label) => checks.push({ label, pass: true })
const fail = (label, hint) => checks.push({ label, pass: false, hint })

const token = process.env.VERCEL_API_TOKEN?.trim()
const projectId = process.env.VERCEL_PROJECT_ID?.trim()
const cname = process.env.STORE_CNAME_TARGET?.trim() || "cname.affisell.com"

ok(`STORE_CNAME_TARGET → ${cname}`)

if (token && projectId) {
  ok(`Vercel API configured (project ${projectId.slice(0, 8)}…)`)
} else {
  fail(
    "Vercel auto-SSL",
    "Set VERCEL_API_TOKEN + VERCEL_PROJECT_ID on Vercel for 1-click merchant HTTPS"
  )
}

for (const rel of [
  "lib/store-custom-domain-activation.ts",
  "lib/store-subdomain-provisioning.ts",
  "app/api/cron/sync-store-vercel-domains/route.ts",
  "app/api/store/verify-domain/route.ts",
  "scripts/provision-store-subdomains.ts",
]) {
  if (existsSync(resolve(process.cwd(), rel))) ok(`file ${rel}`)
  else fail(`file ${rel}`, "Missing")
}

/** Real TLS handshake with SNI and full verification — the browser's view. */
function probeTls(host, timeoutMs = 8000) {
  return new Promise((done) => {
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: true })
    const finish = (r) => {
      clearTimeout(timer)
      socket.destroy()
      done(r)
    }
    const timer = setTimeout(() => finish({ ok: false, code: "TIMEOUT" }), timeoutMs)
    socket.once("secureConnect", () => finish(socket.authorized ? { ok: true } : { ok: false, code: "CERT_UNTRUSTED" }))
    socket.once("error", (e) => finish({ ok: false, code: e.code || e.message }))
  })
}

const REMEDIATION = `
  Why: a proxy in front of the app (Cloudflare) answers the TLS handshake first. Its free Universal certificate covers
  only ONE label under the apex (*.affisell.com). A two-level host such as {slug}.shops.affisell.com gets NO certificate,
  so browsers show ERR_SSL_VERSION_OR_CIPHER_MISMATCH — even though Vercel reports the domain as configured.

  Fix (choose one):
   1. Cloudflare → SSL/TLS → Edge Certificates → "Order Advanced Certificate" for  shops.affisell.com  and
      *.shops.affisell.com  (Advanced Certificate Manager, paid). Keep SSL/TLS mode on "Full".
   2. Free alternative: set the *.shops DNS record to "DNS only" (grey cloud) pointing to cname.vercel-dns.com so Vercel
      issues a certificate per store host (the app registers each one). You lose Cloudflare's proxy/WAF for these hosts.

  Until it is fixed the app keeps stores on https://affisell.com/shops/{slug} (their status shows "unreachable") and
  recovers by itself on the next cron run (every 30 min) once the handshake succeeds.`

const offline = process.argv.includes("--offline")
const slugArg = process.argv.slice(2).find((a) => !a.startsWith("--"))

let wildcardBroken = false
if (!offline) {
  const suffix = (process.env.AFFISELL_STORE_HOST_SUFFIX?.trim() || "shops.affisell.com").toLowerCase().replace(/\.$/, "")
  const apex = suffix.split(".").slice(1).join(".") || suffix
  const targets = [
    { host: apex, label: `HTTPS on the apex (${apex})` },
    { host: `tls-check.${suffix}`, label: `HTTPS on the storefront wildcard (*.${suffix})`, critical: true },
    ...(slugArg ? [{ host: `${slugArg}.${suffix}`, label: `HTTPS on store host ${slugArg}.${suffix}`, critical: true }] : []),
  ]

  let cloudflare = false
  try {
    cloudflare = (await dns.resolveNs(apex)).some((n) => /cloudflare/i.test(n))
  } catch {
    /* no NS info — not essential */
  }

  for (const t of targets) {
    const r = await probeTls(t.host)
    if (r.ok) ok(t.label)
    else {
      fail(t.label, `${t.host}: ${r.code}${cloudflare ? " (DNS is on Cloudflare)" : ""}`)
      if (t.critical) wildcardBroken = true
    }
  }
  if (wildcardBroken) {
    console.error(REMEDIATION)
    console.error("")
  }
}

const failed = checks.filter((c) => !c.pass)
for (const c of checks) {
  console.log(c.pass ? `✓ ${c.label}` : `✗ ${c.label}${c.hint ? ` — ${c.hint}` : ""}`)
}

if (failed.length > 0) {
  console.error(
    wildcardBroken
      ? `\n${failed.length} check(s) failed — store subdomains cannot be opened over HTTPS yet (fix above).`
      : `\n${failed.length} check(s) failed — merchants will need manual Vercel Domains.`
  )
  process.exit(1)
}

console.log("\nOK — Custom domain + auto subdomain SSL ready (cron sync-store-vercel-domains every 30 min).")
console.log("One-shot: npm run provision:store-subdomains")
