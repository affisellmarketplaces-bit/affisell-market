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

  it("roundtrips window.name payload", () => {
    const name = buildAeCaptureWindowName("s1", "tok.test")
    expect(parseAeCaptureWindowName(name)).toEqual({
      sessionId: "s1",
      captureToken: "tok.test",
    })
  })
})
