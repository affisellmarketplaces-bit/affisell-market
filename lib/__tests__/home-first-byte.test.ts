import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * The home's first byte must never wait for the catalogue. `HomeLcpPreloadBoundary` awaits the catalogue shell
 * (database: category tree, listings, offer counts); rendered outside a Suspense boundary it held back the whole
 * page — 10.1 s with an unreachable database, measured in CI (docs/PERF-HOME-2026-11.md). This pins the boundary.
 */
const src = readFileSync(path.resolve(__dirname, "../../app/page.tsx"), "utf8")

describe("home first byte", () => {
  it("the catalogue-awaiting LCP preload is rendered inside <Suspense>", () => {
    expect(src).toMatch(/<Suspense[^>]*>\s*<HomeLcpPreloadBoundary\b[^>]*\/>\s*<\/Suspense>/)
  })
})
