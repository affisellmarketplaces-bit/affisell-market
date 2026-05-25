import { describe, expect, it } from "vitest"

import {
  fastCheckoutNeedsLogin,
  fastCheckoutRedirected,
  type FastCheckoutResult,
} from "@/lib/fast-checkout-client"

describe("FastCheckoutResult guards", () => {
  it("narrows redirected success", () => {
    const ok: FastCheckoutResult = { ok: true, status: "redirected" }
    expect(fastCheckoutRedirected(ok)).toBe(true)
    expect(fastCheckoutNeedsLogin(ok)).toBe(false)
  })

  it("narrows auth failure without accessing reason on success", () => {
    const auth: FastCheckoutResult = { ok: false, status: "auth" }
    expect(fastCheckoutRedirected(auth)).toBe(false)
    expect(fastCheckoutNeedsLogin(auth)).toBe(true)
  })
})
