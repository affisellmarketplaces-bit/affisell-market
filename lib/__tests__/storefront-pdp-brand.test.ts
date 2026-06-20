import { describe, expect, it } from "vitest"

import { storefrontPdpBrandClasses } from "@/lib/storefront-pdp-brand"

describe("storefrontPdpBrandClasses", () => {
  it("uses Affisell violet tokens on marketplace PDP", () => {
    const classes = storefrontPdpBrandClasses(false)
    expect(classes.ctaPrimary).toContain("from-violet-600")
    expect(classes.pageShell).toContain("violet")
  })

  it("uses Brand Studio CSS hooks on affiliate shop PDP", () => {
    const classes = storefrontPdpBrandClasses(true)
    expect(classes.ctaPrimary).toBe("store-pdp-cta-primary relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 lg:h-14 lg:rounded-full lg:text-base")
    expect(classes.pageShell).toBe("affisell-storefront-pdp-shell")
    expect(classes.chipSelected).toContain("store-pdp-chip-selected")
    expect(classes.swatchSelectedRing).not.toContain("store-pdp-chip-selected")
  })
})
