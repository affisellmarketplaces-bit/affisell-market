import { describe, expect, it } from "vitest"

import { parsePhotoStudioTranslatePayload } from "@/lib/photo-studio-translate"

describe("photo-studio-translate", () => {
  it("parses vision segments with target locale", () => {
    const result = parsePhotoStudioTranslatePayload(
      JSON.stringify({
        sourceLocale: "en",
        segments: [
          {
            original: "SALE",
            translated: "PROMO",
            xPercent: 10,
            yPercent: 20,
            widthPercent: 25,
            heightPercent: 8,
            textColor: "#ffffff",
          },
        ],
      }),
      "fr"
    )
    expect(result?.targetLocale).toBe("fr")
    expect(result?.segments).toHaveLength(1)
    expect(result?.segments[0]?.translated).toBe("PROMO")
  })

  it("returns empty segments when none detected", () => {
    const result = parsePhotoStudioTranslatePayload(
      JSON.stringify({ sourceLocale: "other", segments: [] }),
      "en"
    )
    expect(result?.segments).toEqual([])
    expect(result?.targetLocale).toBe("en")
  })
})
