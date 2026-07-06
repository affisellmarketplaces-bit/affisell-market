import { describe, expect, it } from "vitest"

import { loadAppMessages } from "@/lib/i18n-load-messages"
import {
  pickClientMessages,
  slimClientMessagesForDedicatedStorefront,
} from "@/lib/i18n-slim-client-messages"

describe("i18n-slim-client-messages", () => {
  it("drops storefront.brandStudio from buyer slim bundle", () => {
    const full = loadAppMessages("en")
    const slim = pickClientMessages(full, ["storefront", "boutique"])
    const storefront = slim.storefront as Record<string, unknown>
    expect(storefront.brandStudio).toBeUndefined()
    expect(storefront.buyerChrome).toBeTruthy()
    expect(slim.boutique).toBeTruthy()
  })

  it("includes PDP namespaces on shop product paths", () => {
    const full = loadAppMessages("en")
    const slim = slimClientMessagesForDedicatedStorefront(
      full,
      "/shops/demo-shop/product/ap_123"
    )
    expect(slim.Product).toBeTruthy()
    expect(slim.reviews).toBeTruthy()
    expect(slim.marketplace).toBeTruthy()
    expect((slim.storefront as Record<string, unknown>).brandStudio).toBeUndefined()
  })

  it("keeps minimal bundle on supplier storefront paths", () => {
    const full = loadAppMessages("en")
    const slim = slimClientMessagesForDedicatedStorefront(full, "/store/supplier/acme")
    expect(slim.errors).toBeTruthy()
    expect(slim.storefront).toBeUndefined()
    expect(slim.boutique).toBeUndefined()
  })

  it("shop home slim is smaller than full bundle", () => {
    const full = loadAppMessages("en")
    const slim = slimClientMessagesForDedicatedStorefront(full, "/shops/demo-shop")
    expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(full).length * 0.35)
  })
})
