import { describe, expect, it } from "vitest"

import {
  buildAeCaptureWindowName,
  createAeCaptureToken,
  parseAeCaptureWindowName,
  verifyAeCaptureToken,
} from "@/lib/fulfillment/ae-capture-token"

describe("ae-capture-token", () => {
  it("creates and verifies token for session", () => {
    const sessionId = "sess_abc"
    const productId = "prod_xyz"
    const token = createAeCaptureToken(sessionId, productId)
    expect(verifyAeCaptureToken(token, sessionId, productId)).toBe(true)
    expect(verifyAeCaptureToken(token, "other", productId)).toBe(false)
  })

  it("roundtrips window.name payload with product id", () => {
    const name = buildAeCaptureWindowName("prod1", "s1", "tok.test")
    expect(parseAeCaptureWindowName(name)).toEqual({
      productId: "prod1",
      sessionId: "s1",
      captureToken: "tok.test",
    })
  })
})
