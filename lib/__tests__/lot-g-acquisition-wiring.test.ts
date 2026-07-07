import { describe, expect, it } from "vitest"

import { buildCommandKCatalog } from "@/lib/command-k-catalog"
import { buildFooterGlobalContent } from "@/lib/footer-global-content"

describe("Lot G — acquisition wiring", () => {
  it("routes guest sell segment to /sell", () => {
    const items = buildCommandKCatalog(undefined, false)
    const sellHub = items.find((i) => i.id === "sell-on-affisell")
    const becomeSeller = items.find((i) => i.id === "become-seller")
    expect(sellHub?.href).toBe("/sell")
    expect(becomeSeller?.href).toBe("/sell")
  })

  it("exposes /sell in global footer sell section", () => {
    const t = (key: string) => key
    const content = buildFooterGlobalContent(t, { name: "Affisell", siret: "000" }, 2026)
    const sell = content.sections.find((s) => s.id === "sell")
    expect(sell?.links[0]).toEqual({ href: "/sell", label: "sellOnAffisell" })
    expect(sell?.links.some((l) => l.href === "/sell/affiliate-program")).toBe(true)
    expect(sell?.links.some((l) => l.href === "/creators")).toBe(false)
  })
})
