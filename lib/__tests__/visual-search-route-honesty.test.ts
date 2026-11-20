import { describe, expect, it } from "vitest"

import { POST } from "@/app/api/search/visual/route"

describe("POST /api/search/visual — no fabricated similarity", () => {
  it("answers 501 'not available' and returns no result, let alone a score", async () => {
    const res = await POST()
    expect(res.status).toBe(501)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.error).toBe("visual_search_unavailable")
    expect(body).not.toHaveProperty("results")
    expect(JSON.stringify(body)).not.toMatch(/match/i)
  })
})
