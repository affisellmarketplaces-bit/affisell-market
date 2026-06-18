import { describe, expect, it } from "vitest"

import { readJsonResponse } from "@/lib/read-json-response"

describe("readJsonResponse", () => {
  it("returns empty object for empty body", async () => {
    const res = new Response("", { status: 500 })
    await expect(readJsonResponse(res)).resolves.toEqual({})
  })

  it("parses valid JSON", async () => {
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 })
    await expect(readJsonResponse(res)).resolves.toEqual({ ok: true })
  })
})
