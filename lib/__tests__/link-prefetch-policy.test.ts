import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { VIEWPORT_LINK_PREFETCH } from "@/lib/link-prefetch-policy"

const read = (f: string) => readFileSync(path.resolve(__dirname, "../..", f), "utf8")

describe("visible links never force a full-page prefetch", () => {
  it("the policy is Next's default (auto), not `true`", () => {
    expect(VIEWPORT_LINK_PREFETCH).toBeNull()
  })
  it.each(["components/navigation/fast-link.tsx", "components/navigation/nav-pill.tsx"])("%s uses the policy", (f) => {
    const src = read(f)
    expect(src).toContain("VIEWPORT_LINK_PREFETCH")
    expect(src).not.toMatch(/prefetch:\s*(?:prefetch\s*\?\?\s*)?true\b/)
  })
})
