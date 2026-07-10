#!/usr/bin/env node
/**
 * Writes Lighthouse CI results to GITHUB_STEP_SUMMARY + lighthouse-summary.md (PR comment).
 * Run after: npm run lighthouse:mobile
 */
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { devLocalhostUrl } from "./dev-localhost-url.mjs"

const ROOT = process.cwd()
const LHCI_DIR = resolve(ROOT, ".lighthouseci")
const OUT_PATH = resolve(ROOT, "lighthouse-summary.md")
const MARKER = "<!-- affisell-lighthouse-mobile -->"

function readLatestLhr() {
  const manifestPath = resolve(LHCI_DIR, "manifest.json")
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    const entry = Array.isArray(manifest) ? manifest.at(-1) : manifest
    const jsonRel = entry?.jsonPath ?? entry?.url
    if (jsonRel) {
      const jsonPath = resolve(LHCI_DIR, jsonRel)
      if (existsSync(jsonPath)) return JSON.parse(readFileSync(jsonPath, "utf8"))
    }
  }

  const jsonFiles = existsSync(LHCI_DIR)
    ? readdirSync(LHCI_DIR).filter((name) => name.endsWith(".json") && name.startsWith("lhr-"))
    : []
  if (jsonFiles.length === 0) return null
  jsonFiles.sort()
  return JSON.parse(readFileSync(resolve(LHCI_DIR, jsonFiles.at(-1)), "utf8"))
}

function ms(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  return `${Math.round(value)} ms`
}

function score(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  return value.toFixed(2)
}

function main() {
  const lhr = readLatestLhr()
  if (!lhr) {
    console.error("[lighthouse-ci-summary] No LHR JSON found in .lighthouseci/")
    process.exit(1)
  }

  const url = lhr.finalUrl ?? lhr.requestedUrl ?? devLocalhostUrl("/")
  const perf = lhr.categories?.performance?.score
  const fcp = lhr.audits?.["first-contentful-paint"]?.numericValue
  const lcp = lhr.audits?.["largest-contentful-paint"]?.numericValue
  const tbt = lhr.audits?.["total-blocking-time"]?.numericValue
  const cls = lhr.audits?.["cumulative-layout-shift"]?.numericValue
  const tti = lhr.audits?.interactive?.numericValue

  const reportLink = (() => {
    const linksPath = resolve(LHCI_DIR, "links.json")
    if (!existsSync(linksPath)) return null
    try {
      const links = JSON.parse(readFileSync(linksPath, "utf8"))
      return links?.[url] ?? Object.values(links ?? {})[0] ?? null
    } catch {
      return null
    }
  })()

  const lines = [
    MARKER,
    "### Lighthouse mobile — home `/`",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Performance | ${score(perf)} |`,
    `| FCP | ${ms(fcp)} |`,
    `| LCP | ${ms(lcp)} |`,
    `| TBT | ${ms(tbt)} |`,
    `| CLS | ${typeof cls === "number" ? cls.toFixed(3) : "—"} |`,
    `| TTI | ${ms(tti)} |`,
    "",
    reportLink ? `📊 [Full report](${reportLink})` : "",
    "",
    "_Budgets: `lighthouse-budgets.cjs` (warn = baseline regression, error = severe)._",
  ].filter(Boolean)

  const markdown = lines.join("\n")
  writeFileSync(OUT_PATH, `${markdown}\n`, "utf8")

  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) {
    appendFileSync(summaryPath, `\n${markdown}\n`)
  }

  console.log("[lighthouse-ci-summary]", {
    url,
    performance: score(perf),
    fcp: ms(fcp),
    lcp: ms(lcp),
    tbt: ms(tbt),
    cls: typeof cls === "number" ? cls.toFixed(3) : "—",
    reportLink,
  })
}

main()
