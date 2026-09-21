import { describe, expect, it } from "vitest"

import { splitBreadcrumb } from "@/components/supplier/guided-taxonomy-suggestions"

describe("splitBreadcrumb", () => {
  it("shows the leaf first and keeps the trail as context", () => {
    expect(splitBreadcrumb("Home › Kitchen › Blenders")).toEqual({ leaf: "Blenders", trail: "Home › Kitchen" })
    expect(splitBreadcrumb("Électronique > Téléphones")).toEqual({ leaf: "Téléphones", trail: "Électronique" })
  })
  it("handles a single segment", () => {
    expect(splitBreadcrumb("Blenders")).toEqual({ leaf: "Blenders", trail: "" })
  })
})
