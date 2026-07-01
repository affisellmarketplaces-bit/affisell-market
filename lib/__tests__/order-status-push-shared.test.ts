import { describe, expect, it } from "vitest"

import { resolveOrderPushTarget } from "@/lib/order-status-push-shared"

describe("resolveOrderPushTarget", () => {
  it("prefers buyerUserId over email", () => {
    expect(
      resolveOrderPushTarget({
        buyerUserId: "user_abc",
        customerEmail: "buyer@example.com",
      })
    ).toEqual({ kind: "user_id", userId: "user_abc" })
  })

  it("falls back to email when no buyerUserId", () => {
    expect(
      resolveOrderPushTarget({
        buyerUserId: null,
        customerEmail: " Buyer@Example.com ",
      })
    ).toEqual({ kind: "email", email: "buyer@example.com" })
  })

  it("returns none when both missing", () => {
    expect(resolveOrderPushTarget({ buyerUserId: null, customerEmail: "" })).toEqual({
      kind: "none",
    })
  })
})
