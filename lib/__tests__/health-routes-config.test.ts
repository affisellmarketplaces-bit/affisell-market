import fs from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) => fs.readFileSync(p, "utf8")

describe("health & cold-start safeguards (static)", () => {
  it("health/migrations casts regclass to text (Prisma cannot deserialize regclass)", () => {
    const src = read("app/api/health/migrations/route.ts")
    const calls = src.match(/to_regclass\([^)]*\)[^`]*/g) ?? []
    expect(calls.length).toBe(2)
    for (const c of calls) expect(c).toContain("::text")
  })

  it("marketplace read routes allow a cold database wake-up (>10 s)", () => {
    const cfg = JSON.parse(read("vercel.json")) as { functions: Record<string, { maxDuration: number }> }
    for (const route of ["products", "facets"]) {
      expect(cfg.functions[`app/api/marketplace/${route}/route.ts`]?.maxDuration).toBeGreaterThanOrEqual(30)
    }
    expect(cfg.functions["app/api/health/warm/route.ts"]?.maxDuration).toBeGreaterThanOrEqual(30)
  })
})
