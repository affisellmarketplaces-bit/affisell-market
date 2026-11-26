import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Every locale catalog (`messages/*.json`, ~3.4 MB) must stay out of the browser bundle.
 *
 * `lib/i18n-load-messages.ts` imports all eight catalogs; once a "use client" module reached it statically, the
 * bundler put a 2.2 MB chunk (770 KB gzip) on EVERY page — measured on the home page: Lighthouse mobile LCP 10.8 s,
 * TBT 3.3 s locally. Client components get their strings from `NextIntlClientProvider` (`useTranslations`) or from a
 * small dedicated copy module (`lib/page-error-copy.ts`, `lib/global-error-copy.ts`).
 *
 * Static imports only: `import()` / `next/dynamic` produce a separate chunk loaded on demand.
 */
const ROOT = path.resolve(__dirname, "../..")
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "medusa-backend", "e2e", "__tests__", "public"])
const EXTS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"]

/** Known debt — remove an entry when it is fixed; never add one (use useTranslations / a small copy module). */
const KNOWN_OFFENDERS = new Set<string>([])

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(p, out)
    else if (/\.(tsx?|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(p)
  }
  return out
}

/** package.json "imports", resolved with the "browser" condition — what the client bundler does. */
const PACKAGE_IMPORTS = (JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).imports ?? {}) as Record<
  string,
  string | { browser?: string; default?: string }
>

function resolveImport(from: string, spec: string): string | null {
  let base: string
  const mapped = PACKAGE_IMPORTS[spec]
  if (mapped) {
    const target = typeof mapped === "string" ? mapped : (mapped.browser ?? mapped.default)
    return target ? path.join(ROOT, target) : null
  }
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2))
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec)
  else return null
  for (const ext of EXTS) {
    const candidate = base + ext
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

const importCache = new Map<string, string[]>()
function staticImports(file: string): string[] {
  const cached = importCache.get(file)
  if (cached) return cached
  const src = fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
  const specs: string[] = []
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/gm)) {
    const clause = m[1]!.trim()
    if (/^\{\s*type\s[^,]*\}$/.test(clause)) continue // `import { type X } from` — erased
    specs.push(m[2]!)
  }
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specs.push(m[1]!)
  const resolved = specs.map((s) => resolveImport(file, s)).filter((x): x is string => x !== null)
  importCache.set(file, resolved)
  return resolved
}

function isCatalog(file: string): boolean {
  const rel = path.relative(ROOT, file)
  return rel === path.join("lib", "i18n-load-messages.ts") || /^messages[\\/][^\\/]+\.json$/.test(rel)
}

/** Returns the import chain from `entry` to a catalog, or null. */
function chainToCatalog(entry: string): string[] | null {
  const parent = new Map<string, string | null>([[entry, null]])
  const queue = [entry]
  while (queue.length) {
    const file = queue.shift()!
    if (isCatalog(file)) {
      const chain: string[] = []
      for (let c: string | null | undefined = file; c; c = parent.get(c)) chain.unshift(path.relative(ROOT, c))
      return chain
    }
    if (file.endsWith(".json")) continue
    for (const next of staticImports(file)) {
      if (!parent.has(next)) {
        parent.set(next, file)
        queue.push(next)
      }
    }
  }
  return null
}

describe("locale catalogs stay out of client bundles", { timeout: 60_000 }, () => {
  const clientFiles = sourceFiles(ROOT).filter((f) => /^\s*["']use client["']/m.test(fs.readFileSync(f, "utf8").slice(0, 300)))

  it("no new client module statically imports every catalog", () => {
    const offenders: string[] = []
    for (const f of clientFiles) {
      const rel = path.relative(ROOT, f)
      if (KNOWN_OFFENDERS.has(rel)) continue
      const chain = chainToCatalog(f)
      if (chain) offenders.push(chain.join(" -> "))
    }
    expect(offenders).toEqual([])
  })

  it("the home page and root layout entries are clean (regression of the 2.2 MB chunk)", () => {
    for (const rel of [
      "app/error.tsx",
      "app/global-error.tsx",
      "components/footer/footer-mobile-shell.tsx",
      "components/LanguageSwitcher.tsx",
      "components/HeroSection.tsx",
    ]) {
      expect(chainToCatalog(path.join(ROOT, rel)), rel).toBeNull()
    }
  })

  it("tMessage() reaches the browser catalog source, never the catalogs", () => {
    const browserSource = path.join(ROOT, "lib/i18n-catalog-source.browser.ts")
    expect(resolveImport(path.join(ROOT, "lib/i18n-pick-message.ts"), "#i18n-catalog")).toBe(browserSource)
    expect(chainToCatalog(path.join(ROOT, "lib/i18n-pick-message.ts"))).toBeNull()
    expect(chainToCatalog(path.join(ROOT, "components/legal/CookieBanner.tsx"))).toBeNull()
    expect(chainToCatalog(path.join(ROOT, "components/dona/DonaPublicWidget.tsx"))).toBeNull()
  })

  it("the known-debt list only names files that still need it", () => {
    for (const rel of KNOWN_OFFENDERS) {
      expect(chainToCatalog(path.join(ROOT, rel)), `${rel} is fixed — remove it from KNOWN_OFFENDERS`).not.toBeNull()
    }
  })
})
