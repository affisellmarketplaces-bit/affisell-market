import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/shipping/supplier-shipping-profile.server", () => ({
  loadSupplierShopShippingOffersMap: vi.fn(async () =>
    new Map([
      [
        "s1",
        [
          { carrierId: "eu_gls", deliveryMin: 2, deliveryMax: 4 },
          { carrierId: "eu_dpd", deliveryMin: 3, deliveryMax: 7 },
        ],
      ],
    ])
  ),
}))

import { applyShopDeliveryWindows } from "@/lib/shipping/apply-shop-delivery-windows.server"

describe("applyShopDeliveryWindows", () => {
  it("uses the supplier's shop window and nothing else", async () => {
    const out = await applyShopDeliveryWindows([
      { supplierId: "s1", deliveryMin: null, deliveryMax: null },
      { supplierId: "s2", deliveryMin: null, deliveryMax: null },
    ])
    expect([out[0].deliveryMin, out[0].deliveryMax]).toEqual([2, 7])
    expect([out[1].deliveryMin, out[1].deliveryMax]).toEqual([null, null])
  })

  it("is idempotent and drops the supplier hint", async () => {
    const once = await applyShopDeliveryWindows([{ supplierId: "s1", deliveryMin: null, deliveryMax: null }])
    expect("supplierId" in once[0]).toBe(false)
    expect(await applyShopDeliveryWindows(once)).toEqual(once)
  })
})
