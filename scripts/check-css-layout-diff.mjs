#!/usr/bin/env node
/**
 * "Does this CSS safety net move anything?" — a layout diff for global CSS rules, guest pages, phone widths.
 *
 * Loads each page, records the box (x, y, width, height) of EVERY element, injects the rule(s), records again and
 * lists whatever moved. A defensive rule that only matters when something overflows must produce an empty diff on
 * pages that don't overflow; any element it moves is either the bug it fixes or a regression to look at.
 *
 *   node scripts/check-css-layout-diff.mjs --css-file=rule.css /pricing /creators ...
 *   node scripts/check-css-layout-diff.mjs --css-file=rule.css --widths=375,320 --from=crawl.txt
 *
 * `--css-file`  CSS to inject (wrap in `@layer base { … }` to reproduce the app's cascade: utilities must still win)
 *               (to check a rule that is ALREADY shipped, inject the override that neutralises it: the diff is the same)
 * `--from`      read page paths from an audit log (lines like "✓ /path"), so a crawl result can be replayed
 * Env: BASE_URL (default http://localhost:3001). Read-only, GET only. Exits 1 when something moved.
 */
import { readFileSync } from "node:fs"

import { chromium } from "@playwright/test"

const BASE = (process.env.BASE_URL ?? "http://localhost:3001").replace(/\/$/, "")
const flags = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=")
      return [k, v ?? "true"]
    })
)
const cssFile = flags.get("css-file")
if (!cssFile) {
  console.error("usage: check-css-layout-diff.mjs --css-file=rule.css [--widths=375,320] [--from=audit.log] [/paths…]")
  process.exit(1)
}
const css = readFileSync(cssFile, "utf8")
const widths = (flags.get("widths") ?? "375").split(",").map(Number)
const fromLog = flags.get("from")
  ? [...readFileSync(flags.get("from"), "utf8").matchAll(/^[✓✗⚠] (\/\S*)/gmu)].map((m) => m[1])
  : []
const paths = [...new Set([...process.argv.slice(2).filter((a) => a.startsWith("/")), ...fromLog])]
if (!paths.length) {
  console.error("no pages given")
  process.exit(1)
}

const FREEZE = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}"

/** Runs in the page: every element's box, in document order. */
const measure = () =>
  [...document.body.querySelectorAll("*")].map((el) => {
    const r = el.getBoundingClientRect()
    return [r.x, r.y, r.width, r.height]
  })

const browser = await chromium.launch()
let moved = 0
let pagesChanged = 0
let pagesDone = 0

for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  console.log(`\n── ${width}px · ${paths.length} page(s)`)

  for (const path of paths) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 })
      await page.waitForTimeout(2_500)
      await page.addStyleTag({ content: FREEZE })

      const style = await page.addStyleTag({ content: css })
      await page.waitForTimeout(200)
      const withRule = await page.evaluate(measure)
      await style.evaluate((el) => el.remove())
      await page.waitForTimeout(200)
      const withoutRule = await page.evaluate(measure)

      const [before, after] = [withoutRule, withRule]
      pagesDone += 1
      if (before.length !== after.length) {
        console.log(`✗ ${path}  DOM changed between measurements (${before.length} vs ${after.length} elements) — re-run`)
        continue
      }
      const changed = []
      for (let i = 0; i < before.length; i += 1) {
        if (before[i].some((v, k) => Math.abs(v - after[i][k]) > 0.5)) changed.push(i)
      }
      if (changed.length === 0) {
        console.log(`✓ ${path}  (${before.length} boxes identical)`)
        continue
      }
      moved += changed.length
      pagesChanged += 1
      console.log(`✗ ${path}  ${changed.length} of ${before.length} boxes moved`)
      const sample = await page.evaluate((idx) => {
        const els = [...document.body.querySelectorAll("*")]
        return idx.slice(0, 4).map((i) => `<${els[i].tagName.toLowerCase()}> ${String(els[i].className).slice(0, 90)}`)
      }, changed)
      for (const line of sample) console.log(`    ${line}`)
    } catch (err) {
      console.log(`? ${path}  ${err instanceof Error ? err.message.split("\n")[0] : err}`)
    }
  }
  await context.close()
}

await browser.close()
console.log(
  moved
    ? `\n${pagesChanged} of ${pagesDone} page(s) changed (${moved} boxes). Review each: it is either the bug being fixed or a regression.`
    : `\nNo box moved on ${pagesDone} page load(s): the rule is inert where nothing overflows.`
)
process.exit(moved ? 1 : 0)
