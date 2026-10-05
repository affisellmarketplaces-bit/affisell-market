#!/usr/bin/env node
/**
 * Mobile horizontal-overflow audit (guest, headless).
 *
 * `html` and `.affisell-page-shell` clip on the x axis, so an over-wide descendant is never scrollable on a phone —
 * it is silently cut off. This loads pages at a phone viewport and reports every element that sticks out of the
 * screen without being contained by an ancestor that scrolls/clips *and* fits.
 *
 *   npm run audit:mobile-overflow                       # default guest pages on http://127.0.0.1:3001
 *   node scripts/audit-mobile-overflow.mjs /pricing /marketplace
 *   BASE_URL=https://preview.example.com WIDTH=360 node scripts/audit-mobile-overflow.mjs
 *
 * Exits 1 when any page has an offender. Read-only: GET navigation only, no sign-in, no writes.
 */
import { chromium } from "@playwright/test"

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "")
const WIDTH = Number(process.env.WIDTH ?? 375)
const HEIGHT = Number(process.env.HEIGHT ?? 812)

const DEFAULT_PATHS = [
  "/",
  "/marketplace",
  "/discover",
  "/pricing",
  "/creators",
  "/partners",
  "/agent",
  "/contact",
  "/login",
  "/signup",
  "/cart",
  "/wishlist",
]

const paths = process.argv.slice(2).filter((a) => a.startsWith("/"))

/** Runs in the page. Returns the root offenders (an offender whose parent is not itself an offender). */
function auditInPage() {
  const vw = document.documentElement.clientWidth
  // Page-level wrappers (html, body, the page shell) clip the x axis for everything — they must not count as
  // containment, that is the very thing being audited. Any other scroller/clipping box that fits the screen does
  // (carousel viewports, rounded cards, tab strips).
  const isPageWrapper = (a) =>
    a === document.body || a === document.documentElement || a.classList.contains("affisell-page-shell")
  const containsOverflow = (el) => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      if (isPageWrapper(a) || getComputedStyle(a).overflowX === "visible") continue
      const r = a.getBoundingClientRect()
      if (r.left >= -1 && r.right <= vw + 1) return true
    }
    return false
  }
  const offenders = new Set()
  for (const el of document.body.querySelectorAll("*")) {
    const cs = getComputedStyle(el)
    if (cs.position === "fixed" || cs.display === "none" || cs.visibility === "hidden") continue
    if (el.closest("[aria-hidden='true'], svg")) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right <= vw + 1 && r.left >= -1) continue
    if (containsOverflow(el)) continue
    offenders.add(el)
  }
  const roots = [...offenders].filter((el) => !offenders.has(el.parentElement))
  const shell = document.querySelector(".affisell-page-shell")
  return {
    shellOverflowPx: shell ? shell.scrollWidth - shell.clientWidth : null,
    roots: roots.slice(0, 8).map((el) => {
      const r = el.getBoundingClientRect()
      return {
        tag: el.tagName.toLowerCase(),
        cls: String(el.className ?? "").slice(0, 110),
        text: (el.textContent ?? "").trim().slice(0, 40),
        left: Math.round(r.left),
        right: Math.round(r.right),
      }
    }),
  }
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()

let failed = 0
for (const path of paths.length ? paths : DEFAULT_PATHS) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 })
    await page.waitForTimeout(2_500)
    const finalPath = new URL(page.url()).pathname
    const { shellOverflowPx, roots } = await page.evaluate(auditInPage)
    // Only visible elements fail the audit. Shell scrollWidth alone also counts decorative pseudo-elements (shine
    // bands, glows) that the shell clips and nobody sees — worth a note, not a failure.
    const bad = roots.length > 0
    if (bad) failed += 1
    const redirected = finalPath !== path ? ` → ${finalPath}` : ""
    const note = !bad && (shellOverflowPx ?? 0) > 1 ? `  (note: ${shellOverflowPx}px of clipped decoration)` : ""
    console.log(`${bad ? "✗" : "✓"} ${path}${redirected}${bad ? `  (shell overflow ${shellOverflowPx}px)` : note}`)
    for (const o of roots) console.log(`    <${o.tag}> x ${o.left}→${o.right}  "${o.text}"  ${o.cls}`)
  } catch (err) {
    failed += 1
    console.log(`✗ ${path}  ${err instanceof Error ? err.message : err}`)
  }
}

await browser.close()
console.log(failed ? `\n${failed} page(s) overflow at ${WIDTH}px.` : `\nNo horizontal overflow at ${WIDTH}px.`)
process.exit(failed ? 1 : 0)
