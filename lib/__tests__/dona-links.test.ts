import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  DONA_LANDING_PATH,
  DONA_LINKABLE_FIRST_SEGMENTS,
  DONA_LOGIN_PATH,
  DONA_REFERENCED_PATHS,
  DONA_SIGNUP_PATH,
  toInternalPath,
} from "@/lib/dona/dona-links"

const APP_DIR = path.join(process.cwd(), "app")

/**
 * Does `app/` contain a page for this URL path? Route groups `(x)` are transparent. A `[param]` folder matches any
 * segment BELOW the first level only — a top-level `[locale]` / `[username]` would otherwise make every URL "exist".
 */
function routeExists(urlPath: string, dir: string = APP_DIR, depth = 0): boolean {
  const segments = urlPath.split("?")[0]!.split("/").filter(Boolean)
  if (segments.length === 0) return existsSync(path.join(dir, "page.tsx"))
  const [head, ...rest] = segments
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (!statSync(full).isDirectory()) continue
    if (/^\(.+\)$/.test(entry)) {
      if (routeExists(urlPath, full, depth)) return true
    } else if (entry === head || (depth > 0 && /^\[[^.\]][^\]]*\]$/.test(entry))) {
      if (rest.length === 0 ? existsSync(path.join(full, "page.tsx")) : routeExists("/" + rest.join("/"), full, depth + 1)) return true
    }
  }
  return false
}

describe("Dona only names pages that exist", () => {
  for (const p of DONA_REFERENCED_PATHS) {
    it(p, () => expect(routeExists(p), `${p} has no page in app/`).toBe(true))
  }

  it("sends each role to ACCOUNT CREATION, and keeps the login page for people who already have an account", () => {
    expect(DONA_SIGNUP_PATH.supplier).toBe("/signup/supplier")
    expect(DONA_SIGNUP_PATH.reseller).toBe("/signup/affiliate")
    expect(DONA_SIGNUP_PATH.buyer).toBe("/signup/customer")
    for (const role of ["supplier", "reseller", "buyer"] as const) {
      expect(DONA_SIGNUP_PATH[role]).toMatch(/^\/signup\//)
      expect(DONA_LOGIN_PATH[role]).toMatch(/^\/login\//)
    }
    expect(DONA_LANDING_PATH.supplier).toBe("/become-supplier")
  })

  it("every segment the linkifier recognises is a real top-level route folder (a prefix such as /product/:id counts)", () => {
    const topLevel = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        if (!statSync(path.join(dir, entry)).isDirectory()) return []
        return /^\(.+\)$/.test(entry) ? topLevel(path.join(dir, entry)) : [entry]
      })
    const folders = new Set(topLevel(APP_DIR))
    for (const seg of DONA_LINKABLE_FIRST_SEGMENTS) {
      expect(folders.has(seg), `/${seg} is not a route in app/`).toBe(true)
    }
  })

  it("the route checker itself rejects unknown pages", () => {
    expect(routeExists("/definitely-not-a-route")).toBe(false)
    expect(routeExists("/signup/nope")).toBe(false)
  })
})

describe("toInternalPath", () => {
  it("keeps relative paths, rewrites our hosts, leaves other hosts alone", () => {
    expect(toInternalPath("/signup/supplier")).toBe("/signup/supplier")
    expect(toInternalPath("https://affisell.com/signup/supplier?x=1")).toBe("/signup/supplier?x=1")
    expect(toInternalPath("www.affisell.com/pricing")).toBe("/pricing")
    expect(toInternalPath("https://affisell-market.vercel.app")).toBe("/")
    expect(toInternalPath("https://stripe.com/docs")).toBeNull()
    expect(toInternalPath("//evil.example/x")).toBeNull()
    expect(toInternalPath("javascript:alert(1)")).toBeNull()
    expect(toInternalPath("https://affisell.com.evil.example/signup")).toBeNull()
  })
})
