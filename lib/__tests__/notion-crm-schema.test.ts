import { describe, expect, it } from "vitest"

import {
  buildNotionLeadCreateProperties,
  detectNotionCrmSchema,
  mapCrmAffisellStatus,
  normalizeNotionDatabaseId,
} from "@/lib/crm/notion-crm-schema"

describe("normalizeNotionDatabaseId", () => {
  it("adds dashes to compact UUID", () => {
    expect(normalizeNotionDatabaseId("391d7495a6a280db96b4cafa17859f80")).toBe(
      "391d7495-a6a2-80db-96b4-cafa17859f80"
    )
  })
})

describe("detectNotionCrmSchema", () => {
  it("detects CRM Affisell layout", () => {
    expect(
      detectNotionCrmSchema({
        Nom: { type: "title" },
        "E-mail": { type: "email" },
        Status: { type: "status" },
      })
    ).toBe("crm_affisell")
  })

  it("detects supplier pipeline layout", () => {
    expect(
      detectNotionCrmSchema({
        Name: { type: "title" },
        Status: { type: "select" },
        Notes: { type: "rich_text" },
      })
    ).toBe("supplier_pipeline")
  })
})

describe("buildNotionLeadCreateProperties", () => {
  it("maps enterprise lead to CRM Affisell columns", () => {
    const props = buildNotionLeadCreateProperties("crm_affisell", {
      name: "Maison Demo",
      contactEmail: "alex@maison.demo",
      notes: "[Enterprise · Grande marque]",
      dernierContactIso: "2026-07-03",
    })

    expect(props.Nom).toEqual({
      title: [{ text: { content: "Maison Demo" } }],
    })
    expect(props["E-mail"]).toEqual({ email: "alex@maison.demo" })
    expect(props.Date).toEqual({ date: { start: "2026-07-03" } })
    expect(props.SupplierId).toEqual({
      rich_text: [{ text: { content: "[Enterprise · Grande marque]" } }],
    })
  })
})

describe("mapCrmAffisellStatus", () => {
  it("marks enterprise notes as Lead", () => {
    expect(mapCrmAffisellStatus("paid", "[Enterprise · Grande marque]")).toBe("Lead")
  })

  it("maps payment statuses for supplier rows", () => {
    expect(mapCrmAffisellStatus("paid", null)).toBe("Actif")
    expect(mapCrmAffisellStatus("failed", null)).toBe("Lost")
  })
})
