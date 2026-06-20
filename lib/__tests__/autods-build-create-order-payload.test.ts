import { describe, expect, it } from "vitest"

import {
  buildAutoDsCreateOrderPayload,
  extractAutoDsOrderId,
  orderEligibleForAutoDs,
  resolveAutoDsProductId,
} from "@/lib/autods/build-create-order-payload"
import type { AutoDsConfig } from "@/lib/autods/config"

const config: AutoDsConfig = {
  apiKey: "test",
  createOrderUrl: "https://gw.autods.com/auto-order/order/create-external",
  storeId: 101,
  storeName: "ECOM STORE",
  buySiteId: "Amazon",
  supplier: 23,
  region: 4,
}

describe("autods build-create-order-payload", () => {
  it("resolves autods product id from importSource", () => {
    expect(
      resolveAutoDsProductId({
        importSource: "autods",
        sourceProductId: "PROD-123",
        sourceSkuId: null,
        sourceUrl: null,
        supplierSku: null,
        supplierWholesaleCents: null,
        basePriceCents: 1200,
        name: "Leggings",
      })
    ).toBe("PROD-123")
  })

  it("builds external order payload from paid order snapshot", () => {
    const payload = buildAutoDsCreateOrderPayload({
      config,
      order: {
        id: "ord_test_1",
        quantity: 2,
        variantLabel: "Gris Foncé · M",
        customerEmail: "buyer@example.com",
        customerPhone: "+33601020304",
        sellingPriceCents: 3585,
        shippingAddress: {
          name: "Jane Doe",
          line1: "12 rue de Paris",
          city: "Lyon",
          postal_code: "69001",
          country: "FR",
        },
      },
      product: {
        name: "Leonie Leggings",
        importSource: "autods",
        sourceProductId: "AUTODS-9988",
        sourceSkuId: "B08K2JZTKZ",
        sourceUrl: "https://amazon.com/dp/B08K2JZTKZ",
        supplierSku: "SKU-LEG-1",
        supplierWholesaleCents: 890,
        basePriceCents: 900,
      },
    })

    expect(payload.sell_site_order_id).toBe("ord_test_1")
    expect(payload.autods_product_id).toBe("AUTODS-9988")
    expect(payload.quantity_to_buy).toBe(2)
    expect(payload.first_name).toBe("Jane")
    expect(payload.last_name).toBe("Doe")
    expect(payload.suggested_buy_price).toBe(8.9)
    expect(
      orderEligibleForAutoDs({
        importSource: "autods",
        sourceProductId: "x",
        sourceSkuId: null,
        sourceUrl: null,
        supplierSku: null,
        supplierWholesaleCents: null,
        basePriceCents: 1,
        name: "n",
      })
    ).toBe(true)
  })

  it("extracts remote order id from nested response", () => {
    expect(extractAutoDsOrderId({ order: { id: 445566 } })).toBe("445566")
    expect(extractAutoDsOrderId({ id: "abc" })).toBe("abc")
  })
})
