import { describe, expect, it } from "vitest"

import { sanitizeVideoProReturnPath } from "@/lib/video-paywall-return-path"

describe("sanitizeVideoProReturnPath", () => {
  it("accepts supplier dashboard paths", () => {
    expect(sanitizeVideoProReturnPath("/dashboard/supplier/products/abc")).toBe(
      "/dashboard/supplier/products/abc"
    )
  })

  it("strips query and hash", () => {
    expect(sanitizeVideoProReturnPath("/dashboard/supplier?upgrade=paywall#x")).toBe(
      "/dashboard/supplier"
    )
  })

  it("rejects non-supplier paths", () => {
    expect(sanitizeVideoProReturnPath("/marketplace/foo")).toBeNull()
    expect(sanitizeVideoProReturnPath("/dashboard/affiliate")).toBeNull()
  })

  it("rejects protocol-relative and absolute URLs", () => {
    expect(sanitizeVideoProReturnPath("//evil.com/dashboard/supplier")).toBeNull()
    expect(sanitizeVideoProReturnPath("https://evil.com/dashboard/supplier")).toBeNull()
  })

  it("rejects non-strings", () => {
    expect(sanitizeVideoProReturnPath(null)).toBeNull()
    expect(sanitizeVideoProReturnPath(42)).toBeNull()
  })
})
