import { describe, expect, it } from "vitest"

import { deriveSplitDisplayStatus } from "@/lib/admin/splits/derive-split-status"

describe("deriveSplitDisplayStatus", () => {
  it("returns SUCCESS when both transfers succeeded", () => {
    expect(
      deriveSplitDisplayStatus([
        { status: "SUCCESS" },
        { status: "SUCCESS" },
      ])
    ).toBe("SUCCESS")
  })

  it("returns PARTIAL when one succeeded", () => {
    expect(
      deriveSplitDisplayStatus([
        { status: "SUCCESS" },
        { status: "FAILED" },
      ])
    ).toBe("PARTIAL")
  })

  it("returns FAILED when none succeeded and none pending", () => {
    expect(
      deriveSplitDisplayStatus([
        { status: "FAILED" },
        { status: "FAILED" },
      ])
    ).toBe("FAILED")
  })

  it("returns PENDING when none succeeded but still pending", () => {
    expect(
      deriveSplitDisplayStatus([
        { status: "PENDING" },
        { status: "PENDING" },
      ])
    ).toBe("PENDING")
  })
})
