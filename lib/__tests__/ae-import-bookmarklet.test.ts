import { describe, expect, it } from "vitest"

import {
  buildUniversalAeImportBookmarklet,
  isAffisellAeCaptureMessage,
  isAliExpressOrigin,
} from "@/lib/fulfillment/ae-import-bookmarklet"

describe("ae-import-bookmarklet", () => {
  it("builds universal javascript: href", () => {
    const href = buildUniversalAeImportBookmarklet("https://affisell.com")
    expect(href.startsWith("javascript:")).toBe(true)
    expect(decodeURIComponent(href)).toContain("affisellAfc")
    expect(decodeURIComponent(href)).toContain("__AER_DATA__")
  })

  it("validates capture postMessage", () => {
    expect(
      isAffisellAeCaptureMessage(
        {
          type: "AFFISELL_AE_CAPTURE",
          productId: "p1",
          aeUrl: "https://fr.aliexpress.com/item/1.html",
          aerData: { pageModule: {} },
        },
        "p1"
      )
    ).toBe(true)
    expect(
      isAffisellAeCaptureMessage(
        { type: "AFFISELL_AE_CAPTURE", productId: "p2", aeUrl: "x", aerData: {} },
        "p1"
      )
    ).toBe(false)
  })

  it("detects aliexpress origins", () => {
    expect(isAliExpressOrigin("https://fr.aliexpress.com")).toBe(true)
    expect(isAliExpressOrigin("https://affisell.com")).toBe(false)
  })
})
