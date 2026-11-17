#!/usr/bin/env node
/**
 * Lists every Largest-Contentful-Paint candidate of a page in a REAL Chromium (Playwright), with the element that
 * produced it — what Lighthouse's own LCP-element audit fails to report on some traces. Mobile viewport, CPU slowed
 * ×4 and a slow network through the DevTools protocol (same order of magnitude as the Lighthouse CI run). Read-only:
 * it loads the page, waits, prints, closes. Usage: node scripts/lcp-candidates.mjs <url> [waitMs] [cookie=value]
 * The optional cookie (e.g. affisell_cookie_consent=false) measures a RETURNING visitor next to a first visit.
 */
import { chromium } from "@playwright/test"

const url = process.argv[2] ?? "http://localhost:3001/"
const waitMs = Number(process.argv[3] ?? 20_000)
const cookieArg = process.argv[4]

const browser = await chromium.launch()
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  if (cookieArg?.includes("=")) {
    const [name, ...rest] = cookieArg.split("=")
    await context.addCookies([{ name, value: rest.join("="), url }])
  }
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
  await cdp.send("Network.enable")
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  await page.addInitScript(() => {
    const w = window
    w.__lcp = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const el = e.element
        w.__lcp.push({
          t: Math.round(e.startTime),
          size: e.size,
          tag: el ? el.tagName.toLowerCase() : null,
          id: el?.id || null,
          cls: el ? String(el.className?.baseVal ?? el.className ?? "").slice(0, 80) : null,
          testid: el?.closest?.("[data-testid]")?.getAttribute("data-testid") ?? null,
          text: el ? (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 90) : null,
          url: e.url ? e.url.slice(0, 120) : null,
        })
      }
    }).observe({ type: "largest-contentful-paint", buffered: true })
  })
  const t0 = Date.now()
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForTimeout(waitMs)
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0]
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]
    return { ttfb: Math.round(n?.responseStart ?? 0), dcl: Math.round(n?.domContentLoadedEventEnd ?? 0), load: Math.round(n?.loadEventEnd ?? 0), fcp: Math.round(fcp?.startTime ?? 0) }
  })
  const lcp = await page.evaluate(() => window.__lcp)
  console.log(`[lcp] ${url}${cookieArg ? ` (cookie ${cookieArg})` : " (first visit)"} · ttfb ${nav.ttfb} ms · fcp ${nav.fcp} ms · dcl ${nav.dcl} ms · load ${nav.load} ms · observed ${Date.now() - t0} ms`)
  for (const c of lcp) console.log(`[lcp]   candidate at ${c.t} ms · ${c.size}px² · <${c.tag}${c.id ? `#${c.id}` : ""}> testid=${c.testid ?? "-"} · "${c.text ?? ""}"${c.url ? ` · ${c.url}` : ""} · .${c.cls ?? ""}`)
} finally {
  await browser.close()
}
