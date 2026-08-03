import { describe, expect, it } from "vitest"

import { createAutoBuyEnlistRequest } from "@/lib/auto-buy-enlist-request"

describe("createAutoBuyEnlistRequest", () => {
  it("rejects invalid AliExpress URL without hitting DB", async () => {
    const result = await createAutoBuyEnlistRequest({
      supplierId: "supplier_test",
      aeUrl: "https://example.com/not-ae",
    })
    expect(result).toEqual({ ok: false, error: "invalid_aliexpress_url" })
  })
})
