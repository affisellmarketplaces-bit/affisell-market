import { describe, expect, it } from "vitest"

import { resolveOrderAccessRole } from "@/lib/order-access"

describe("resolveOrderAccessRole", () => {
  const order = {
    supplierId: "sup-1",
    affiliateId: "aff-1",
    buyerUserId: null,
    customerEmail: "buyer@example.com",
  }

  it("matches supplier and affiliate by user id", () => {
    expect(resolveOrderAccessRole(order, { id: "sup-1" })).toBe("SUPPLIER")
    expect(resolveOrderAccessRole(order, { id: "aff-1" })).toBe("AFFILIATE")
  })

  it("matches buyer by email when buyerUserId unset", () => {
    expect(resolveOrderAccessRole(order, { id: "x", email: "buyer@example.com" })).toBe("CUSTOMER")
    expect(resolveOrderAccessRole(order, { id: "x", email: "other@example.com" })).toBeNull()
  })
})
