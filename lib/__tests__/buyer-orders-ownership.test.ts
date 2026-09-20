import { describe, expect, it } from "vitest"

import { buyerOrdersOwnerFilter } from "@/lib/account-orders-payload"
import { buyerOwnsOrder } from "@/lib/order-return-policy"

describe("buyer order ownership (account OR e-mail)", () => {
  const order = { customerEmail: "Paid.With@Link.com", buyerUserId: "u1" }

  it("matches by e-mail regardless of case", () => {
    expect(buyerOwnsOrder(order, "paid.with@link.com")).toBe(true)
  })

  it("matches the account that placed the order even when the checkout e-mail differs", () => {
    expect(buyerOwnsOrder(order, "account@other.com", "u1")).toBe(true)
  })

  it("never matches another account with another e-mail", () => {
    expect(buyerOwnsOrder(order, "someone@else.com", "u2")).toBe(false)
    expect(buyerOwnsOrder({ customerEmail: "a@b.com", buyerUserId: null }, "x@y.com", "u1")).toBe(false)
  })

  it("does not treat a missing account id as a match", () => {
    expect(buyerOwnsOrder({ customerEmail: "a@b.com", buyerUserId: null }, "x@y.com", null)).toBe(false)
  })

  it("list filter adds the account branch only when there is an account id", () => {
    expect(buyerOrdersOwnerFilter("a@b.com")).toEqual({ customerEmail: { equals: "a@b.com", mode: "insensitive" } })
    expect(buyerOrdersOwnerFilter("a@b.com", "u1")).toEqual({
      OR: [{ customerEmail: { equals: "a@b.com", mode: "insensitive" } }, { buyerUserId: "u1" }],
    })
    expect(buyerOrdersOwnerFilter("a@b.com", "  ")).toEqual({ customerEmail: { equals: "a@b.com", mode: "insensitive" } })
  })
})
