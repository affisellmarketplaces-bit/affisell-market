import { describe, expect, it } from "vitest"

import { formatEnterpriseLeadNotes } from "@/lib/crm/enterprise-lead-shared"

describe("formatEnterpriseLeadNotes", () => {
  it("includes enterprise metadata for CRM", () => {
    const notes = formatEnterpriseLeadNotes({
      brandName: "Maison Demo",
      contactName: "Alex Brand",
      contactEmail: "alex@maison.demo",
      catalogSize: "1000_10000",
      category: "luxury",
      commerceStack: "shopify",
      message: "Catalogue EU + US",
      locale: "fr",
    })
    expect(notes).toContain("[Enterprise · Grande marque]")
    expect(notes).toContain("alex@maison.demo")
    expect(notes).toContain("1000_10000")
    expect(notes).toContain("shopify")
    expect(notes).toContain("/enterprise")
  })
})
