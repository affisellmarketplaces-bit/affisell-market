import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import type { AbstractIntlMessages } from "next-intl"

import enJson from "@/messages/en.json"
import {
  PDP_NAMESPACES,
  PRIVATE_SURFACE_NAMESPACES,
  omitNamespaces,
  pickNamespaces,
} from "@/lib/i18n-client-scope"

/**
 * The root layout sends the client only the namespaces PUBLIC pages' client code can read; `/dashboard` and `/admin`
 * add the rest (`<IntlScope>`). Removing a namespace a public client component reads would print raw keys, so this
 * test re-derives, from the source, every namespace read by client code reachable from a public route (static and
 * dynamic imports, client context propagated from "use client") and fails if one of them is in
 * PRIVATE_SURFACE_NAMESPACES. A translation call it cannot read statically must be declared in DYNAMIC_RESOLUTIONS.
 */
const ROOT = path.resolve(__dirname, "../..")
const PRIVATE_ROUTE_DIRS = new Set(["dashboard", "admin"])
const EXTS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"]
const en = enJson as unknown as AbstractIntlMessages
const NAMESPACES = new Set(Object.keys(en))

/** Calls whose namespace is computed — file → every namespace it can reach (checked against the code by hand). */
const DYNAMIC_RESOLUTIONS: Record<string, string[]> = {
  // useTranslations(`${variant}.hero`) with variant buyer | creators | partners
  "components/HeroSection.tsx": ["home", "creators", "partners"],
  "components/cart/cart-checkout-shipping-note.tsx": ["cart"],
  "components/marketplace/eu-coverage-banner.tsx": ["marketplace"],
  // root useTranslations(): partnerDock.*, nav.accountMenu.*
  "components/navigation/partner-mobile-dock.tsx": ["partnerDock", "nav"],
  "lib/booking/vertical-copy.ts": ["accountOrders"],
  "lib/emails/email-copy-utils.ts": ["emails"],
  "lib/emails/load-email-copy.ts": ["emails"],
  "lib/listing-logistics-display.ts": ["Product"],
  "lib/order-return-types.ts": ["orderReturns"],
  "lib/logistics/delivery-sla.ts": ["radarTerminal"],
  // useMessages(): Breadcrumb / Product / cart / checkout / wishlist (also wrapped in <IntlScope namespaces=PDP_NAMESPACES>)
  "app/marketplace/[id]/marketplace-listing-detail.tsx": [...PDP_NAMESPACES],
  "app/marketplace/[id]/use-listing-detail-controller.ts": [...PDP_NAMESPACES],
  // forwards the parent's messages plus the namespaces <IntlScope> chose on the server — reads none itself
  "components/providers/intl-messages-extension.tsx": [],
  // the catalog modules themselves (server source; the browser gets lib/i18n-catalog-source.browser.ts)
  "lib/i18n-app-messages.ts": [],
  "lib/i18n-load-messages.ts": [],
}

const PACKAGE_IMPORTS = (JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).imports ?? {}) as Record<
  string,
  string | { browser?: string; default?: string }
>

function resolveImport(from: string, spec: string): string | null {
  const mapped = PACKAGE_IMPORTS[spec]
  if (mapped) {
    const target = typeof mapped === "string" ? mapped : (mapped.browser ?? mapped.default)
    return target ? path.join(ROOT, target) : null
  }
  let base: string
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2))
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec)
  else return null
  for (const ext of EXTS) {
    const candidate = base + ext
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

type Parsed = { deps: string[]; isClient: boolean; namespaces: Set<string>; dynamic: string[] }
const parsedCache = new Map<string, Parsed>()

function parse(file: string): Parsed {
  const cached = parsedCache.get(file)
  if (cached) return cached
  const raw = fs.readFileSync(file, "utf8")
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  const specs: string[] = []
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/gm)) {
    if (/^\{\s*type\s[^,]*\}$/.test(m[1]!.trim())) continue
    specs.push(m[2]!)
  }
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specs.push(m[1]!)
  for (const m of src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1]!)

  const namespaces = new Set<string>()
  const dynamic: string[] = []
  for (const m of src.matchAll(/\b(useTranslations|useMessages|createTranslator)\s*\(([^()]*(?:\([^()]*\))?[^()]*)\)/g)) {
    const arg = m[2]!.trim()
    const literal = arg.match(/^["'`]([A-Za-z0-9_]+)(?:[."'`])/)
    if (m[1] === "useTranslations" && literal && !arg.startsWith("`${")) namespaces.add(literal[1]!)
    else dynamic.push(`${m[1]}(${arg.slice(0, 50)})`)
  }
  for (const m of src.matchAll(/tMessage\(\s*[A-Za-z_.]+\s*,\s*(?:["'`]([^"'`$]*)|([^,)]+))/g)) {
    const first = m[1]?.split(".")[0]
    if (first) namespaces.add(first)
    else dynamic.push(`tMessage(…, ${String(m[2] ?? m[1]).slice(0, 30)})`)
  }
  // Direct access to a messages object (`messages.Product`, `messages.cart.x`): conservative, any variable so named.
  for (const m of src.matchAll(/\bmessages\.([A-Za-z_]\w*)/g)) if (NAMESPACES.has(m[1]!)) namespaces.add(m[1]!)
  if (/\b(appMessagesForLocale|CLIENT_MESSAGES|loadAppMessages)\b/.test(src)) dynamic.push("full catalog access")

  const result: Parsed = {
    deps: specs.map((s) => resolveImport(file, s)).filter((x): x is string => x !== null),
    isClient: /^\s*["']use client["']/m.test(raw.slice(0, 300)),
    namespaces,
    dynamic,
  }
  parsedCache.set(file, result)
  return result
}

function publicRouteEntries(dir = path.join(ROOT, "app"), out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "api" || (dir === path.join(ROOT, "app") && PRIVATE_ROUTE_DIRS.has(entry.name))) continue
      publicRouteEntries(p, out)
    } else if (/^(page|layout|template|error|global-error|loading|not-found|default)\.tsx?$/.test(entry.name)) {
      out.push(p)
    }
  }
  return out
}

/** Every file reachable from a public route, with whether it runs in the browser. */
function publicGraph(): Map<string, boolean> {
  const clientContext = new Map<string, boolean>()
  const queue: Array<[string, boolean]> = publicRouteEntries().map((f) => [f, false])
  while (queue.length) {
    const [file, inherited] = queue.shift()!
    if (file.endsWith(".json")) continue
    const parsed = parse(file)
    const isClient = inherited || parsed.isClient
    const previous = clientContext.get(file)
    if (previous === true || previous === isClient) continue
    clientContext.set(file, isClient)
    for (const dep of parsed.deps) queue.push([dep, isClient])
  }
  return clientContext
}

function publicClientUsage() {
  const used = new Set<string>()
  const unresolved: string[] = []
  for (const [file, isClient] of publicGraph()) {
    if (!isClient) continue
    const rel = path.relative(ROOT, file)
    const parsed = parse(file)
    parsed.namespaces.forEach((n) => used.add(n))
    if (parsed.dynamic.length === 0) continue
    const resolution = DYNAMIC_RESOLUTIONS[rel]
    if (resolution) resolution.forEach((n) => used.add(n))
    else unresolved.push(`${rel}: ${parsed.dynamic.join(", ")}`)
  }
  return { used, unresolved }
}

describe("client message scope (root layout sends public namespaces only)", { timeout: 120_000 }, () => {
  const usage = publicClientUsage()

  it("every translation call public client code makes is readable or declared", () => {
    expect(usage.unresolved).toEqual([])
  })

  it("no namespace a public client component reads is withheld from public pages", () => {
    expect(PRIVATE_SURFACE_NAMESPACES.filter((n) => usage.used.has(n))).toEqual([])
  })

  it("every withheld namespace exists (no stale names)", () => {
    expect(PRIVATE_SURFACE_NAMESPACES.filter((n) => !NAMESPACES.has(n))).toEqual([])
  })

  it("the public subset is substantially lighter (regression guard on the size win)", () => {
    const full = JSON.stringify(en).length
    const scoped = JSON.stringify(omitNamespaces(en, PRIVATE_SURFACE_NAMESPACES)).length
    expect(scoped / full).toBeLessThan(0.6)
  })

  it("pick/omit are complementary: public subset + private extension = the full bundle", () => {
    const merged = { ...omitNamespaces(en, PRIVATE_SURFACE_NAMESPACES), ...pickNamespaces(en, PRIVATE_SURFACE_NAMESPACES) }
    expect(Object.keys(merged).sort()).toEqual(Object.keys(en).sort())
    expect(merged).toEqual(en)
  })

  it("reports namespaces that could still be withheld (information, never fails)", () => {
    const candidates = [...NAMESPACES].filter((n) => !usage.used.has(n) && !PRIVATE_SURFACE_NAMESPACES.includes(n))
    if (candidates.length) console.info("[i18n-client-scope] could also be withheld:", candidates.join(", "))
    expect(Array.isArray(candidates)).toBe(true)
  })
})
