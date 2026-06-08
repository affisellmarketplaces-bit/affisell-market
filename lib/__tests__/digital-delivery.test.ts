import { describe, expect, it } from "vitest"

import {
  digitalDeliveryPublishErrorMessage,
  validateDigitalDeliveryForPublish,
} from "@/lib/digital-delivery/parse-product-digital"
import {
  isValidDigitalAccessUrl,
  resolveDigitalAccessUrl,
} from "@/lib/digital-delivery/resolve-access-url"
import { isDigitalListingKind } from "@/lib/digital-delivery/types"

describe("digital delivery", () => {
  it("detects digital listing kinds", () => {
    expect(isDigitalListingKind("SOFTWARE")).toBe(true)
    expect(isDigitalListingKind("SUBSCRIPTION")).toBe(true)
    expect(isDigitalListingKind("PHYSICAL")).toBe(false)
    expect(isDigitalListingKind(null)).toBe(false)
  })

  it("resolves access URL placeholders", () => {
    const url = resolveDigitalAccessUrl(
      "https://course.test/enroll?oid={{orderId}}&t={{token}}&e={{email}}",
      { orderId: "ord_1", token: "tok_abc", email: "buyer@test.com" }
    )
    expect(url).toContain("oid=ord_1")
    expect(url).toContain("t=tok_abc")
    expect(url).toContain("e=buyer%40test.com")
  })

  it("validates access URLs with placeholders", () => {
    expect(isValidDigitalAccessUrl("https://course.test/{{token}}")).toBe(true)
    expect(isValidDigitalAccessUrl("")).toBe(false)
    expect(isValidDigitalAccessUrl("not-a-url")).toBe(false)
  })

  it("requires access URL when publishing digital instant listings", () => {
    expect(
      validateDigitalDeliveryForPublish(
        "SOFTWARE",
        { digitalAccessUrl: null, digitalInstantDelivery: true },
        false
      )
    ).toBe("digital_access_url_required")

    expect(
      validateDigitalDeliveryForPublish(
        "SOFTWARE",
        { digitalAccessUrl: "https://course.test/{{token}}", digitalInstantDelivery: true },
        false
      )
    ).toBeNull()

    expect(
      validateDigitalDeliveryForPublish(
        "PHYSICAL",
        { digitalAccessUrl: null, digitalInstantDelivery: true },
        false
      )
    ).toBeNull()
  })

  it("maps publish error codes to messages", () => {
    expect(digitalDeliveryPublishErrorMessage("digital_access_url_required")).toContain("URL")
  })
})
