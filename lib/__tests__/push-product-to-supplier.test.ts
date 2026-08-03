import { describe, expect, it } from "vitest"

import { AFFISELL_AUTOBUY_SUPPLIER_EMAIL } from "@/lib/auto-buy-platform-supplier-shared"

describe("admin push-to-supplier constants", () => {
  it("keeps AutoBuy platform email stable for ownership checks", () => {
    expect(AFFISELL_AUTOBUY_SUPPLIER_EMAIL).toBe("autobuy@affisell.internal")
  })
})
