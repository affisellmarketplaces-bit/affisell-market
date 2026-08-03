import { describe, expect, it } from "vitest"

import { enlistAeProductForAutoBuy } from "@/lib/admin/auto-fulfill/enlist-ae-product"

describe("enlistAeProductForAutoBuy", () => {
  it("rejects invalid AliExpress URL without hitting DB", async () => {
    const result = await enlistAeProductForAutoBuy({
      aeUrl: "https://example.com/not-ae",
    })
    expect(result).toEqual({ ok: false, error: "invalid_aliexpress_url" })
  })
})
