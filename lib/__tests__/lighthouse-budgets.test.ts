import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const budgets = require("../../lighthouse-budgets.cjs") as {
  warn: Record<string, { minScore?: number; maxNumericValue?: number }>
  error: Record<string, { minScore?: number; maxNumericValue?: number }>
}

describe("lighthouse-budgets", () => {
  it("defines warn and error thresholds from CI baseline", () => {
    expect(budgets.warn["largest-contentful-paint"]?.maxNumericValue).toBeGreaterThanOrEqual(4500)
    expect(budgets.error["categories:performance"]?.minScore).toBeLessThan(
      budgets.warn["categories:performance"]?.minScore ?? 1
    )
  })
})
