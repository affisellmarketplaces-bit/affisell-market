import { describe, expect, it } from "vitest"

import { parsePastedAerJson } from "@/lib/fulfillment/parse-pasted-aer-json"

describe("parsePastedAerJson", () => {
  it("parses raw JSON object", () => {
    const parsed = parsePastedAerJson('{"pageModule":{"skuComponent":{}}}')
    expect(parsed).toEqual({ pageModule: { skuComponent: {} } })
  })

  it("parses window.__AER_DATA__ assignment", () => {
    const parsed = parsePastedAerJson(
      'window.__AER_DATA__ = {"pageModule":{"x":1}};'
    ) as { pageModule?: { x?: number } }
    expect(parsed.pageModule?.x).toBe(1)
  })
})
