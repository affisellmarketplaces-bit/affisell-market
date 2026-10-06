import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * The proxy (next-intl + guards) must only see page requests. A metadata file it intercepts is treated as a page and
 * answers 404 — `/manifest.webmanifest` did, so Safari/iOS (which fetches it on every page and uses it for "Add to Home
 * Screen") logged a 404 and the PWA manifest never loaded in dev. `/sw.js` had the same problem: it was answered with the
 * home page HTML, so the service worker (Web Push, offline shell) could never register.
 */
function catchAllMatcher(): RegExp {
  const src = readFileSync(join(process.cwd(), "proxy.ts"), "utf8")
  const literal = src.match(/matcher:\s*\[\s*"((?:[^"\\]|\\.)*)"/)?.[1]
  if (!literal) throw new Error("proxy.ts: first matcher entry not found")
  // The literal is a TS string: unescape it, then it is a path-to-regexp pattern that is also a valid RegExp.
  return new RegExp(`^${JSON.parse(`"${literal}"`) as string}$`)
}

describe("proxy matcher", () => {
  const matcher = catchAllMatcher()

  it.each([
    "/manifest.webmanifest",
    "/sw.js",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/icons/icon-192.png",
    "/brand/affisell-mark.svg",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ])("leaves %s to Next (no proxy)", (path) => {
    expect(matcher.test(path)).toBe(false)
  })

  it.each(["/shops/ecom-store", "/marketplace", "/dashboard/affiliate", "/login"])(
    "still runs the proxy on the page %s",
    (path) => {
      expect(matcher.test(path)).toBe(true)
    }
  )
})
