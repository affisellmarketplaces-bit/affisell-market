import { describe, expect, it } from "vitest"

import {
  donaPublicWelcome,
  resolveDonaPublicAudience,
} from "@/lib/dona/dona-audience"

describe("dona audience routing", () => {
  it("home and marketplace = buyer", () => {
    expect(resolveDonaPublicAudience("/")).toBe("buyer")
    expect(resolveDonaPublicAudience("/fr")).toBe("buyer")
    expect(resolveDonaPublicAudience("/de")).toBe("buyer")
    expect(resolveDonaPublicAudience("/marketplace")).toBe("buyer")
    expect(resolveDonaPublicAudience("/discover")).toBe("buyer")
  })

  it("sell and creators = reseller", () => {
    expect(resolveDonaPublicAudience("/sell")).toBe("reseller")
    expect(resolveDonaPublicAudience("/creators")).toBe("reseller")
    expect(resolveDonaPublicAudience("/sell/affiliate-program")).toBe("reseller")
  })

  it("supplier landings = supplier", () => {
    expect(resolveDonaPublicAudience("/supplier")).toBe("supplier")
    expect(resolveDonaPublicAudience("/sell/become-supplier")).toBe("supplier")
  })

  it("buyer welcome avoids revendeur pitch", () => {
    const msg = donaPublicWelcome("buyer", "fr")
    expect(msg.toLowerCase()).toContain("achat")
    expect(msg.toLowerCase()).not.toContain("marge")
  })

  it("reseller welcome mentions margin", () => {
    const msg = donaPublicWelcome("reseller", "fr")
    expect(msg.toLowerCase()).toContain("marge")
  })
})
