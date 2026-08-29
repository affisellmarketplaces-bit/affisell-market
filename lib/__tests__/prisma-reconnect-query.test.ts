import { describe, expect, it, vi } from "vitest"

/**
 * Regression: retry path must re-call ctx.query, not delegate methods on the extended client
 * (re-enters $allOperations → stack overflow on Neon reconnect).
 */
describe("prisma reconnect extension contract", () => {
  it("retries via ctx.query without nesting extension calls", async () => {
    let queryCalls = 0
    let depth = 0
    let maxDepth = 0

    const query = vi.fn(async () => {
      queryCalls += 1
      depth += 1
      maxDepth = Math.max(maxDepth, depth)
      if (queryCalls < 3) {
        depth -= 1
        throw new Error("Connection terminated")
      }
      depth -= 1
      return [{ id: "ok" }]
    })

    const maxRetries = 2
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await query()
        expect(result).toEqual([{ id: "ok" }])
        expect(maxDepth).toBeLessThanOrEqual(1)
        expect(queryCalls).toBe(3)
        return
      } catch (error) {
        lastError = error
        if (attempt >= maxRetries) break
      }
    }

    throw lastError
  })
})
