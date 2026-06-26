import { describe, expect, it } from "vitest"

import { shouldSkipClientFallback } from "@/lib/supplier-gallery-image-persist"

describe("shouldSkipClientFallback", () => {
  it("skips fallback on auth errors", () => {
    expect(shouldSkipClientFallback({ ok: false, status: 401, detail: "Not authenticated" })).toBe(true)
    expect(shouldSkipClientFallback({ ok: false, status: 403, detail: "Forbidden" })).toBe(true)
  })

  it("skips fallback on min dimension", () => {
    expect(
      shouldSkipClientFallback({ ok: false, status: 400, detail: "Minimum 320×320 px (got 100×100)" })
    ).toBe(true)
  })

  it("allows fallback on server/storage failures", () => {
    expect(
      shouldSkipClientFallback({ ok: false, status: 500, detail: "Stockage média indisponible" })
    ).toBe(false)
    expect(shouldSkipClientFallback({ ok: false, detail: "upload_failed" })).toBe(false)
  })
})
