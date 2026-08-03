import { describe, expect, it } from "vitest"

import { enlistAeProductForAutoBuy } from "@/lib/admin/auto-fulfill/enlist-ae-product"
import {
  AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
  AFFISELL_AUTOBUY_SUPPLIER_NAME,
} from "@/lib/auto-buy-platform-supplier"

describe("Affisell AutoBuy platform supplier", () => {
  it("exposes stable platform identity constants", () => {
    expect(AFFISELL_AUTOBUY_SUPPLIER_EMAIL).toBe("autobuy@affisell.internal")
    expect(AFFISELL_AUTOBUY_SUPPLIER_NAME).toBe("Affisell AutoBuy")
  })
})

describe("enlistAeProductForAutoBuy", () => {
  it("rejects invalid AliExpress URL without hitting DB", async () => {
    const result = await enlistAeProductForAutoBuy({
      aeUrl: "https://example.com/not-ae",
    })
    expect(result).toEqual({ ok: false, error: "invalid_aliexpress_url" })
  })
})
