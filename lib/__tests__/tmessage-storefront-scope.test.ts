import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  DEDICATED_SHOP_BASE_KEYS,
  DEDICATED_SHOP_BUYER_FLOW_KEYS,
  DEDICATED_SHOP_PDP_KEYS,
  DEDICATED_SHOP_PUBLIC_PLATFORM_KEYS,
} from "@/lib/i18n-slim-client-messages"

/**
 * In the browser, `tMessage()` reads only the messages the page's provider received (`#i18n-catalog`, PR #15). On a
 * merchant custom domain those are SLIMMED (`slimClientMessagesForDedicatedStorefront`) while the server still reads
 * the full catalogs: a key outside the slim set renders translated on the server and as its fallback in the browser —
 * a hydration mismatch and the wrong text, with no error anywhere.
 *
 * Tripwire: every namespace `tMessage()` reads outside the server must either be sent to dedicated storefronts, or be
 * listed below with the reason it never renders on one (each reason checked against its importers on 2026-11-26). A new namespace fails here until someone decides which.
 * (Path-specific sets — e.g. `Product` only on the PDP — are not modelled; this catches the new-namespace case.)
 */
const PLATFORM_ONLY: Record<string, string> = {
  accountOrders: "/account is redirected to the platform origin on store hosts (lib/custom-domain-path.ts)",
  orderReturns: "buyer account, supplier and admin return panels — /account is redirected off store hosts",
  donaWidget: "Dona is not mounted on dedicated storefronts (app/layout.tsx: leanPlatformChrome)",
  categoryAttributes: "supplier product forms (dashboard)",
  supplier: "supplier dashboard (add-product form, category picker, suggestions)",
  importPage: "reseller URL import / Dropforge (dashboard)",
  radarTerminal: "Radar product and pricing pages (platform)",
  radarPricing: "Radar marketing landing and /pricing (platform)",
  radarShell: "Radar alerts, paywall, cockpit, /pricing (platform)",
  radarConnect: "Radar TikTok connect page (platform)",
  emails: "server-side e-mail sending only (lib/emails/*, imported by API routes and jobs)",
}

const ROOTS = ["app", "components", "lib", "hooks"]
const SERVER_ONLY = (rel: string) =>
  rel.startsWith("app/api/") || /\.server\.tsx?$/.test(rel) || rel.includes("__tests__") || rel.includes("/scripts/")

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

function tMessageNamespaces(): Map<string, Set<string>> {
  const byNamespace = new Map<string, Set<string>>()
  const root = process.cwd()
  for (const dir of ROOTS) {
    for (const file of sourceFiles(path.join(root, dir))) {
      const rel = path.relative(root, file).split(path.sep).join("/")
      if (SERVER_ONLY(rel)) continue
      const src = fs.readFileSync(file, "utf8")
      for (const m of src.matchAll(/\btMessage\(\s*[^,()]+,\s*[`"']([A-Za-z]+)[.`"']/g)) {
        const set = byNamespace.get(m[1]) ?? new Set<string>()
        set.add(rel)
        byNamespace.set(m[1], set)
      }
    }
  }
  return byNamespace
}

describe("tMessage namespaces vs the slim catalogs of dedicated storefronts", () => {
  const sent = new Set<string>([
    ...DEDICATED_SHOP_BASE_KEYS,
    ...DEDICATED_SHOP_PDP_KEYS,
    ...DEDICATED_SHOP_BUYER_FLOW_KEYS,
    ...DEDICATED_SHOP_PUBLIC_PLATFORM_KEYS,
  ])
  const used = tMessageNamespaces()

  it("finds the tMessage call sites (the scan itself works)", () => {
    expect(used.size).toBeGreaterThan(0)
    expect(used.has("accountOrders")).toBe(true)
  })

  it("every namespace is either sent to store hosts or documented as platform-only", () => {
    const unclassified = [...used.entries()]
      .filter(([ns]) => !sent.has(ns) && !(ns in PLATFORM_ONLY))
      .map(([ns, files]) => `${ns} ← ${[...files].join(", ")}`)
    expect(unclassified).toEqual([])
  })

  it("the platform-only list has no stale entry", () => {
    expect(Object.keys(PLATFORM_ONLY).filter((ns) => !used.has(ns))).toEqual([])
  })
})
