import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Libraries that must not be on the home page's FIRST JavaScript (static imports from the modules the page
 * hydrates). Measured 2026-11-26, Lighthouse mobile (CI throttling), 3 runs each, median:
 * framer-motion was reached by four paths (a hero animation that never ran, a `useInView` hook, the ⌘K
 * trigger importing an event-name constant, the reseller/supplier navs importing the palette); removing them
 * took the home page's module JS from 428 to 359 KB gzip, LCP 5.1 → 4.2 s, TBT 1.59 → 1.32 s.
 *
 * `import()` / `next/dynamic` are allowed: they make a separate chunk loaded only when rendered.
 */
const ROOT = path.resolve(__dirname, "../..")
const EXTS = ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]

/** Client modules the home page hydrates near the top of the page (header, hero, deferred loaders). */
const HOME_ENTRIES = [
  "components/home/buyer-premium-hero.tsx",
  "components/nav/app-header.tsx",
  "components/home/home-catalog-deferred-explorer.tsx",
  "components/home/home-below-fold-radars.tsx",
  "components/navigation/command-k-trigger-deferred.tsx",
]
const FORBIDDEN = ["framer-motion", "motion", "cmdk"]

function resolve(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2))
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec)
  else return null
  for (const e of EXTS) {
    const p = base + e
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
  }
  return null
}

/** Static value imports/re-exports only (`import type` and `import()` excluded). */
function staticSpecs(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/gm)) out.push(m[1]!)
  return out
}

function chainsTo(packages: string[], entries: string[]): string[] {
  const parent = new Map<string, string | null>()
  const queue = entries.map((e) => path.join(ROOT, e))
  queue.forEach((e) => parent.set(e, null))
  const found: string[] = []
  while (queue.length) {
    const file = queue.shift()!
    for (const spec of staticSpecs(fs.readFileSync(file, "utf8"))) {
      if (packages.some((p) => spec === p || spec.startsWith(`${p}/`))) {
        const chain = [spec]
        for (let c: string | null | undefined = file; c; c = parent.get(c)) chain.unshift(path.relative(ROOT, c))
        found.push(chain.join(" -> "))
      }
      const next = resolve(file, spec)
      if (next && !parent.has(next)) {
        parent.set(next, file)
        queue.push(next)
      }
    }
  }
  return found
}

describe("home page critical-path JavaScript", () => {
  it("does not statically reach framer-motion or cmdk", () => {
    expect(chainsTo(FORBIDDEN, HOME_ENTRIES)).toEqual([])
  })

  it("renders the hero (the LCP block) as a server component", () => {
    const src = fs.readFileSync(path.join(ROOT, "components/home/buyer-premium-hero.tsx"), "utf8")
    expect(src).not.toMatch(/^\s*["']use client["']/m)
  })

  it("the analyzer does find a real import (guards against a test that can never fail)", () => {
    expect(chainsTo(["framer-motion"], ["components/HeroSection.tsx"]).length).toBeGreaterThan(0)
  })
})
