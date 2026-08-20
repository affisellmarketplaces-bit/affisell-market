import { describe, expect, it } from "vitest"

import {
  productDecoupleFieldsLive,
  syncJobModelLive,
} from "@/lib/integrations/schema-capabilities"

describe("integration schema capabilities", () => {
  it("detects decouple product fields after prisma generate", () => {
    expect(typeof productDecoupleFieldsLive()).toBe("boolean")
  })

  it("detects SyncJob model after prisma generate", () => {
    expect(typeof syncJobModelLive()).toBe("boolean")
  })

  it("reports live decouple schema in dev workspace", () => {
    expect(productDecoupleFieldsLive()).toBe(true)
    expect(syncJobModelLive()).toBe(true)
  })
})
