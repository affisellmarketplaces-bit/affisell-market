#!/usr/bin/env node
/**
 * Mobile horizontal-overflow audit (headless, read-only: GET navigation only, no writes).
 *
 * `html` and `.affisell-page-shell` clip the x axis, so on a phone an over-wide element is never scrollable — it is
 * silently cut off. This loads pages at a phone viewport and reports every element that sticks out of the screen
 * without a scroller/clipping box that fits around it (see scripts/lib/mobile-overflow-probe.js).
 *
 *   npm run audit:mobile-overflow                              guest, default public pages
 *   npm run audit:mobile-overflow -- /pricing /creators        chosen pages
 *   npm run audit:mobile-overflow -- --crawl                   follow the links found on the public entry pages
 *   npm run audit:mobile-overflow -- --locales=de,nl,pl,zh     same pages with each UI language (longer strings)
 *   npm run audit:mobile-overflow -- --stress                  swap data-like text (truncate / clamp / break-words)
 *                                                              for worst-case long strings first (--stress=all: every leaf)
 *   npm run audit:mobile-overflow -- --console                also report, per page, console errors, uncaught exceptions
 *                                                              and failing same-origin requests (HTTP >= 400)
 *   npm run audit:mobile-login -- buyer                         ONE-TIME, you log in yourself in a real window; the
 *                                                              session is saved to .audit-sessions/ (git-ignored)
 *   npm run audit:mobile-overflow -- --preset=buyer            signed-in pages of that role (uses that saved session)
 *
 * Presets (--preset=supplier|affiliate|buyer) list the static routes found in app/ for that role. They need the
 * matching session from audit:mobile-login — without one every page just redirects to the login, which would pass
 * for the wrong reason, so the audit refuses to run and a mid-run bounce to the login counts as a failure.
 *
 * Env: BASE_URL (default http://localhost:3001) · WIDTH/HEIGHT (default 375x812) · STORAGE_STATE (explicit session file).
 * Exits 1 when any page has a visible offender (clipped decoration is only a note).
 */
import { existsSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "@playwright/test"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const PROBE = join(ROOT, "scripts/lib/mobile-overflow-probe.js")

const BASE = (process.env.BASE_URL ?? "http://localhost:3001").replace(/\/$/, "")
const FLAGS = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=")
      return [k, v ?? "true"]
    })
)
const WIDTH = Number(FLAGS.get("width") ?? process.env.WIDTH ?? 375)
const HEIGHT = Number(FLAGS.get("height") ?? process.env.HEIGHT ?? 812)
const SESSION_NAME = FLAGS.get("session") ?? FLAGS.get("preset")
const SESSION_FILE = process.env.STORAGE_STATE ?? (SESSION_NAME ? join(ROOT, ".audit-sessions", `${SESSION_NAME}.json`) : null)
const STORAGE_STATE = SESSION_FILE && existsSync(SESSION_FILE) ? SESSION_FILE : null
const MAX_PAGES = Number(FLAGS.get("max") ?? 40)
const LOCALES = (FLAGS.get("locales") ?? "").split(",").filter(Boolean)
const CONSOLE = FLAGS.has("console")
const STRESS = FLAGS.has("stress") ? (FLAGS.get("stress") === "all" ? "all" : "hinted") : null

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
const CRAWL_SEEDS = ["/", "/discover", "/shops", "/pricing", "/marketplace/bestsellers", "/help", "/blog"]
/** Never followed by the crawler: not pages, or not reachable / not safe as a guest. */
const CRAWL_SKIP =
  /^\/(api|_next|admin|auth|logout|signout|wc-auth|wp-json|embed|e2e|shield-blocked|offline|dashboard)(\/|$)|\.[a-z0-9]{2,5}$/i

/** Static (non-dynamic) page routes under app/<dir>, e.g. "/dashboard/affiliate/settings". */
function staticRoutes(dir) {
  const base = join(ROOT, "app", dir)
  if (!existsSync(base)) return []
  const routes = []
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name)
      if (!statSync(full).isDirectory() || name.includes("[") || name.startsWith("_") || name.startsWith("@")) continue
      if (existsSync(join(full, "page.tsx"))) routes.push(`/${relative(join(ROOT, "app"), full).replaceAll("\\", "/")}`)
      walk(full)
    }
  }
  if (existsSync(join(base, "page.tsx"))) routes.push(`/${dir}`)
  walk(base)
  return routes
}

const PRESETS = {
  supplier: () => staticRoutes("dashboard/supplier"),
  affiliate: () => [...staticRoutes("dashboard/affiliate"), ...staticRoutes("dashboard/reseller")],
  buyer: () => [...staticRoutes("marketplace/account"), "/wishlist", "/cart", "/track-order"],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The dev server restarts itself under memory pressure; wait for it instead of reporting a false failure. */
async function waitForServer(maxMs = 240_000) {
  const start = Date.now()
  let told = false
  while (Date.now() - start < maxMs) {
    try {
      await fetch(`${BASE}/`, { method: "HEAD", signal: AbortSignal.timeout(5_000), redirect: "manual" })
      return
    } catch {
      if (!told) console.log(`Waiting for ${BASE} … (not running? start it with: npm run dev)`)
      told = true
      await sleep(2_000)
    }
  }
  throw new Error(`${BASE} is not answering`)
}

async function visit(page, path) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 })
      await page.waitForTimeout(2_500)
      return
    } catch (err) {
      const refused = err instanceof Error && /ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET/.test(err.message)
      if (!refused || attempt >= 2) throw err
      await waitForServer()
    }
  }
}

/** Same-origin page paths linked from the current page, minus anything the crawler must not touch. */
async function linkedPaths(page) {
  const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href))
  const origin = new URL(BASE).origin
  const out = new Set()
  for (const href of hrefs) {
    try {
      const u = new URL(href)
      // BASE may be 127.0.0.1 while the app renders absolute links with localhost.
      const sameSite = u.origin === origin || u.hostname === "localhost" || u.hostname === new URL(BASE).hostname
      if (sameSite && !CRAWL_SKIP.test(u.pathname)) out.add(u.pathname.replace(/\/$/, "") || "/")
    } catch {
      /* ignore malformed */
    }
  }
  return [...out]
}

/** Up to 3 pages per route shape (first segment + depth), so /shops/<slug> is sampled without visiting every shop. */
function sampleByShape(paths, perShape = 3) {
  const seen = new Map()
  return paths.filter((p) => {
    const segs = p.split("/").filter(Boolean)
    const shape = `${segs[0] ?? ""}/${segs.length}`
    const n = seen.get(shape) ?? 0
    seen.set(shape, n + 1)
    return n < perShape
  })
}

async function resolvePaths(page, positional) {
  const preset = FLAGS.get("preset")
  if (preset) {
    if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}" (supplier | affiliate | buyer)`)
    if (!STORAGE_STATE) {
      throw new Error(
        `--preset=${preset} needs a signed-in session: run \`npm run audit:mobile-login -- ${preset}\` once ` +
          `(you log in yourself; saved to .audit-sessions/${preset}.json), or point STORAGE_STATE at a Playwright session file`
      )
    }
    return PRESETS[preset]()
  }
  if (FLAGS.has("session") && !STORAGE_STATE) throw new Error(`no session file at ${SESSION_FILE}`)
  if (positional.length) return positional
  if (!FLAGS.has("crawl")) return DEFAULT_PATHS

  const found = []
  for (const seed of CRAWL_SEEDS) {
    try {
      await visit(page, seed)
      found.push(seed, ...(await linkedPaths(page)))
    } catch (err) {
      console.log(`  (crawl seed ${seed} skipped: ${err instanceof Error ? err.message.split("\n")[0] : err})`)
    }
  }
  return sampleByShape([...new Set(found)]).slice(0, MAX_PAGES)
}

async function main() {
  await waitForServer()
  const browser = await chromium.launch()
  const newContext = async (locale) => {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      ...(STORAGE_STATE ? { storageState: STORAGE_STATE } : {}),
    })
    if (locale) await context.addCookies([{ name: "affisell_locale", value: locale, url: BASE }])
    await context.addInitScript({ path: PROBE })
    return context
  }

  const positional = process.argv.slice(2).filter((a) => a.startsWith("/"))
  const discoveryContext = await newContext(null)
  const paths = await resolvePaths(await discoveryContext.newPage(), positional)
  await discoveryContext.close()

  let failed = 0
  for (const locale of LOCALES.length ? LOCALES : [null]) {
    const tags = [locale ? `lang ${locale}` : null, STRESS ? `stress ${STRESS}` : null, `${WIDTH}px`].filter(Boolean)
    console.log(`\n── ${tags.join(" · ")} · ${paths.length} page(s)`)
    const context = await newContext(locale)
    const page = await context.newPage()

    // --console: what the page complained about while loading. Dev-server noise (HMR socket) and third-party
    // resource failures are not the app's errors; same-origin HTTP >= 400 and any script error are.
    const problems = new Set()
    const origin = new URL(BASE).origin
    if (CONSOLE) {
      page.on("console", (m) => {
        const text = m.text().split("\n")[0].slice(0, 220)
        if (m.type() === "error" && !/webpack-hmr|WebSocket connection|Failed to load resource/.test(text)) {
          problems.add(`console.error: ${text}`)
        }
      })
      page.on("pageerror", (e) => problems.add(`exception: ${String(e.message).split("\n")[0].slice(0, 220)}`))
      page.on("response", (r) => {
        const url = r.url()
        if (r.status() >= 400 && url.startsWith(origin) && !/_next\/static|favicon|webpack-hmr|__nextjs/.test(url)) {
          problems.add(`HTTP ${r.status()} ${new URL(url).pathname}`)
        }
      })
    }

    for (const path of paths) {
      try {
        problems.clear()
        await visit(page, path)
        const finalPath = new URL(page.url()).pathname
        const stressed = STRESS ? await page.evaluate((m) => window.__mobileProbe.stress(m), STRESS) : 0
        const { shellOverflowPx, roots } = await page.evaluate(() => window.__mobileProbe.audit())

        // Only visible elements fail the audit. Shell scrollWidth alone also counts decorative pseudo-elements
        // (shine bands, glows) that the shell clips and nobody sees — worth a note, not a failure.
        const bounced = STORAGE_STATE && /^\/(login|signup)(\/|$)/.test(finalPath) && !/^\/(login|signup)(\/|$)/.test(path)
        if (bounced) {
          failed += 1
          console.log(`⚠ ${path} → ${finalPath}  (session expired or wrong role — NOT audited)`)
          continue
        }
        const bad = roots.length > 0 || (CONSOLE && problems.size > 0)
        if (bad) failed += 1
        const redirected = finalPath !== path ? ` → ${finalPath}` : ""
        const stressNote = STRESS ? ` [${stressed} stressed]` : ""
        const note = !bad && (shellOverflowPx ?? 0) > 1 ? `  (note: ${shellOverflowPx}px of clipped decoration)` : ""
        console.log(`${bad ? "✗" : "✓"} ${path}${redirected}${stressNote}${roots.length > 0 ? `  (shell overflow ${shellOverflowPx}px)` : note}`)
        if (CONSOLE) for (const issue of problems) console.log(`    ! ${issue}`)
        for (const o of roots) {
          console.log(`    <${o.tag}> x ${o.left}→${o.right}${o.stressed ? " [stressed]" : ""}  "${o.text}"  ${o.cls}`)
        }
      } catch (err) {
        failed += 1
        console.log(`✗ ${path}  ${err instanceof Error ? err.message.split("\n")[0] : err}`)
      }
    }
    await context.close()
  }

  await browser.close()
  console.log(
    failed
      ? `\n${failed} page(s) with ${CONSOLE ? "overflow or errors" : "overflow"}.`
      : CONSOLE
        ? "\nNo horizontal overflow, console errors or failing requests."
        : "\nNo horizontal overflow."
  )
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
