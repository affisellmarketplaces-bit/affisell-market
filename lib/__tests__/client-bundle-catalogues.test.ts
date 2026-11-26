import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * The JavaScript every visitor downloads must not contain the whole message catalogues.
 *
 * `lib/i18n-load-messages.ts` imports all eight `messages/*.json` (~3.6 MB of text). Server code may use it; client
 * code may not, because a client module that reaches it — even through a helper re-exported from another file —
 * puts every catalogue in the startup bundle. Measured 2026-11-17: the header's LanguageSwitcher did exactly that
 * (via `lib/i18n-ui-locale.ts` → `lib/i18n-pick-message.ts`), a 2.8 MB chunk on every page.
 *
 * This walks STATIC imports from the root layout, the home pages and the root error boundary; once it enters a
 * `"use client"` module everything below is client code and must not reach a catalogue. Lazy `import()` chunks are
 * followed too: an idle-loaded widget (the Dona chat on every public page) is still downloaded by every visitor a few
 * seconds in. `import type` is not followed.
 */
const root = path.resolve(__dirname, "../..")
const CATALOGUE_LOADERS = new Set(["lib/i18n-load-messages.ts"])
const ENTRIES = ["app/layout.tsx", "app/page.tsx", "app/[locale]/page.tsx", "app/error.tsx"]

/** package.json "imports" with the "browser" condition — what the client bundler resolves (`#i18n-catalog`). */
const PACKAGE_IMPORTS = (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).imports ?? {}) as Record<
  string,
  { browser?: string; default?: string }
>

function resolveSpec(spec: string): string | null {
  if (spec.startsWith("#")) return (PACKAGE_IMPORTS[spec]?.browser ?? PACKAGE_IMPORTS[spec]?.default)?.replace(/^\.\//, "") ?? null
  if (!spec.startsWith("@/")) return null
  const base = spec.slice(2)
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existsSync(path.join(root, base + ext)) && /\.tsx?$/.test(base + ext)) return base + ext
  }
  return null
}

function staticImports(src: string): string[] {
  const out: string[] = []
  const re = /^\s*(import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm
  for (const m of src.matchAll(re)) {
    if (m[2]) continue // import type / export type
    out.push(m[3] ?? m[4]!)
  }
  for (const m of src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]!)
  return out
}

describe("startup bundle never contains the whole message catalogues", () => {
  it("no client module reachable (statically or lazily) from the root layout / home / error boundary imports them", () => {
    const violations: string[] = []
    const seen = new Set<string>()
    const walk = (file: string, chain: string[], client: boolean) => {
      const key = `${file}|${client}`
      if (seen.has(key)) return
      seen.add(key)
      const src = readFileSync(path.join(root, file), "utf8")
      const isClient = client || /^\s*["']use client["']/.test(src)
      for (const spec of staticImports(src)) {
        if (isClient && /^@\/messages\/[a-z]{2}\.json$/.test(spec)) violations.push([...chain, file, spec].join(" -> "))
        const dep = resolveSpec(spec)
        if (!dep) continue
        if (isClient && CATALOGUE_LOADERS.has(dep)) {
          violations.push([...chain, file, dep].join(" -> "))
          continue
        }
        walk(dep, [...chain, file], isClient)
      }
    }
    for (const e of ENTRIES) walk(e, [], false)
    expect(violations).toEqual([])
  })
})
