#!/usr/bin/env node
/**
 * Prints WHY the home page is slow, from the raw Lighthouse reports LHCI leaves in `.lighthouseci/` (all runs, the
 * median one in detail): server response time, the LCP element and its phases (TTFB / load delay / load time / render
 * delay), render-blocking resources, the costliest scripts, main-thread work, the heaviest requests. Read-only, never
 * fails the job (a missing audit prints « — »). Run after `npm run lighthouse:mobile`, even when its assertions fail.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const DIR = resolve(process.cwd(), ".lighthouseci")
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.startsWith("lhr-") && f.endsWith(".json")).sort() : []
if (files.length === 0) {
  console.log("[lh-diag] no Lighthouse report found in .lighthouseci/")
  process.exit(0)
}

const ms = (v) => (typeof v === "number" && Number.isFinite(v) ? `${Math.round(v)} ms` : "—")
const kb = (v) => (typeof v === "number" && Number.isFinite(v) ? `${Math.round(v / 1024)} KiB` : "—")
const short = (u) => {
  try {
    const url = new URL(u)
    return (url.pathname + url.search).slice(0, 110)
  } catch {
    return String(u ?? "").slice(0, 110)
  }
}
const audit = (lhr, id) => lhr.audits?.[id]
const num = (lhr, id) => audit(lhr, id)?.numericValue

const reports = files.map((f) => JSON.parse(readFileSync(resolve(DIR, f), "utf8")))
console.log(`[lh-diag] ${reports.length} run(s)`)
for (const [i, lhr] of reports.entries()) {
  console.log(
    `[lh-diag] run ${i + 1}: LCP ${ms(num(lhr, "largest-contentful-paint"))} · FCP ${ms(num(lhr, "first-contentful-paint"))} · TTFB ${ms(num(lhr, "server-response-time"))} · TBT ${ms(num(lhr, "total-blocking-time"))} · CLS ${num(lhr, "cumulative-layout-shift")?.toFixed?.(3) ?? "—"}`
  )
}
const sorted = [...reports].sort((a, b) => (num(a, "largest-contentful-paint") ?? 0) - (num(b, "largest-contentful-paint") ?? 0))
const lhr = sorted[Math.floor(sorted.length / 2)]
console.log(`[lh-diag] --- median run (by LCP) · Lighthouse ${lhr.lighthouseVersion} · ${lhr.finalDisplayedUrl ?? lhr.finalUrl}`)

// LCP element + phases (Lighthouse 12: `largest-contentful-paint-element` has two tables; 13: `lcp-breakdown-insight`).
const lcpEl = audit(lhr, "largest-contentful-paint-element") ?? audit(lhr, "lcp-breakdown-insight")
for (const item of lcpEl?.details?.items ?? []) {
  if (item?.type === "table") {
    for (const row of item.items ?? []) {
      if (row.node) console.log(`[lh-diag] LCP element: ${row.node.nodeLabel ?? ""} · ${String(row.node.snippet ?? "").slice(0, 160)}`)
      if (row.phase || row.label) console.log(`[lh-diag]   phase ${row.phase ?? row.label}: ${ms(row.timing ?? row.duration)}`)
    }
  } else if (item?.node) {
    console.log(`[lh-diag] LCP element: ${item.node.nodeLabel ?? ""} · ${String(item.node.snippet ?? "").slice(0, 160)}`)
  }
}
if (!lcpEl?.details) console.log(`[lh-diag] LCP element audit: ${JSON.stringify(lcpEl ?? null).slice(0, 600)}`)
// The trace's own LCP candidate (independent of the audit's table shape).
for (const el of audit(lhr, "trace-elements")?.details?.items ?? []) {
  if (el.traceEventType === "largest-contentful-paint") console.log(`[lh-diag] trace LCP node: ${el.node?.nodeLabel ?? ""} · ${String(el.node?.snippet ?? "").slice(0, 200)} · ${el.node?.selector ?? ""}`)
}
const lcpReq = audit(lhr, "lcp-lazy-loaded")?.score === 0 ? "LCP image is LAZY-loaded" : null
if (lcpReq) console.log(`[lh-diag] ${lcpReq}`)

const list = (id, title, cols, max = 8) => {
  const items = audit(lhr, id)?.details?.items ?? []
  if (!items.length) return
  console.log(`[lh-diag] ${title}`)
  for (const row of items.slice(0, max)) console.log(`[lh-diag]   ${cols(row)}`)
}
list("render-blocking-resources", "render-blocking:", (r) => `${ms(r.wastedMs)} · ${kb(r.totalBytes)} · ${short(r.url)}`)
list("bootup-time", "script execution (bootup):", (r) => `${ms(r.total)} (script ${ms(r.scripting)}, parse ${ms(r.scriptParseCompile)}) · ${short(r.url)}`)
list("mainthread-work-breakdown", "main thread:", (r) => `${ms(r.duration)} · ${r.groupLabel ?? r.group}`)
list("total-byte-weight", "heaviest requests:", (r) => `${kb(r.totalBytes)} · ${short(r.url)}`, 12)
list("unused-javascript", "unused JS:", (r) => `${kb(r.wastedBytes)} of ${kb(r.totalBytes)} · ${short(r.url)}`)
list("long-tasks", "long tasks:", (r) => `${ms(r.duration)} at ${ms(r.startTime)} · ${short(r.url)}`)
list("third-party-summary", "third parties:", (r) => `${ms(r.blockingTime)} blocking · ${kb(r.transferSize)} · ${typeof r.entity === "string" ? r.entity : r.entity?.text ?? ""}`)
list("font-display", "fonts without font-display:", (r) => short(r.url))

const net = audit(lhr, "network-requests")?.details?.items ?? []
if (net.length) {
  const byType = {}
  for (const r of net) {
    const t = r.resourceType ?? "Other"
    byType[t] ??= { n: 0, bytes: 0 }
    byType[t].n += 1
    byType[t].bytes += r.transferSize ?? 0
  }
  console.log(`[lh-diag] requests: ${net.length} · ${Object.entries(byType).map(([t, v]) => `${t} ${v.n}/${kb(v.bytes)}`).join(" · ")}`)
  const doc = net.find((r) => r.resourceType === "Document")
  if (doc) console.log(`[lh-diag] document: ${ms(doc.networkEndTime - doc.networkRequestTime)} · ${kb(doc.transferSize)} · status ${doc.statusCode}`)
  const fetches = {}
  for (const r of net.filter((x) => x.resourceType === "Fetch" || x.resourceType === "XHR")) {
    const k = short(r.url).split("?")[0]
    fetches[k] = (fetches[k] ?? 0) + 1
  }
  for (const [k, n] of Object.entries(fetches).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`[lh-diag]   fetch ×${n} · ${k}`)
  const late = net.filter((r) => r.resourceType === "Image").sort((a, b) => (a.networkRequestTime ?? 0) - (b.networkRequestTime ?? 0)).slice(0, 4)
  for (const r of late) console.log(`[lh-diag]   image requested at ${ms(r.networkRequestTime)} · done ${ms(r.networkEndTime)} · ${kb(r.transferSize)} · ${short(r.url)}`)
}

// What the heaviest startup scripts CONTAIN (Turbopack keeps one "[project]/…" id per module in the chunk):
// bytes between successive module ids, summed per npm package / app folder. Needs the build output (.next/).
const chunkDir = resolve(process.cwd(), ".next/static/chunks")
if (net.length && existsSync(chunkDir)) {
  const scripts = net
    .filter((r) => r.resourceType === "Script" && /\/_next\/static\/chunks\//.test(r.url))
    .sort((a, b) => (b.resourceSize ?? b.transferSize ?? 0) - (a.resourceSize ?? a.transferSize ?? 0))
    .slice(0, 6)
  const owner = (id) => {
    const m = /\[project\]\/(node_modules\/(?:@[^/]+\/)?[^/]+|[^/]+\/[^/]+)/.exec(id)
    return m ? m[1] : "(other)"
  }
  for (const r of scripts) {
    const file = resolve(chunkDir, new URL(r.url).pathname.split("/").pop())
    if (!existsSync(file)) continue
    const src = readFileSync(file, "utf8")
    const marks = [...src.matchAll(/"(\[project\]\/[^"]+)"/g)]
    const sizes = {}
    for (let i = 0; i < marks.length; i++) {
      const end = i + 1 < marks.length ? marks[i + 1].index : src.length
      const k = owner(marks[i][1])
      sizes[k] = (sizes[k] ?? 0) + (end - marks[i].index)
    }
    if (marks.length === 0) {
      // Production chunks carry numeric module ids: name the big libraries by strings they keep at runtime instead.
      const SIGNATURES = {
        "messages JSON (i18n catalogue)": /"supplierDashboard":\{|"errors":\{"page"/g,
        "next-intl / ICU": /MISSING_MESSAGE|INSUFFICIENT_PATH/g,
        "@sentry": /__SENTRY__|sentry_key|sentry\.io/g,
        "framer-motion": /framerAppearId|MotionValue|motionValue/g,
        "react-dom": /Minified React error|react-dom/g,
        "zod": /invalid_type|ZodError/g,
        "lucide-react": /lucide-/g,
        "@radix-ui": /radix-/g,
        "posthog": /posthog/gi,
        "stripe.js": /js\.stripe\.com/g,
        "dompurify": /DOMPurify/g,
        "onnx / ML": /onnxruntime|ort-wasm|tensorflow/g,
        "recharts / d3": /recharts|d3-/g,
        "date libs": /date-fns|Invalid time value/g,
      }
      const found = Object.entries(SIGNATURES).map(([k, re]) => [k, (src.match(re) ?? []).length]).filter(([, n]) => n > 0)
      console.log(`[lh-diag] chunk ${short(r.url)} · ${kb(src.length)} raw · signatures: ${found.map(([k, n]) => `${k}×${n}`).join(", ") || "none"}`)
      continue
    }
    const top = Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 8)
    console.log(`[lh-diag] chunk ${short(r.url)} · ${kb(src.length)} raw · ${marks.length} module ids`)
    for (const [k, v] of top) console.log(`[lh-diag]   ${kb(v)} · ${k}`)
  }
}
