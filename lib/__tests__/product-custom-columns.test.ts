import { describe, expect, it } from "vitest"

import {
  buildDuplicateCustomColumn,
  customColumnSchema,
  labelToCustomColumnKey,
  parseCustomColumnsFromBody,
  validateVariantsCustomData,
} from "@/lib/product-custom-columns"

describe("product-custom-columns", () => {
  it("slugifies labels to snake_case keys", () => {
    expect(labelToCustomColumnKey("Indice IP")).toBe("indice_ip")
    expect(labelToCustomColumnKey("Matière")).toBe("matiere")
  })

  it("validates select column requires options", () => {
    const bad = customColumnSchema.safeParse({
      key: "indice_ip",
      label: "Indice IP",
      type: "select",
      required: true,
    })
    expect(bad.success).toBe(false)
  })

  it("returns line error when required customData missing", () => {
    const columns = [
      {
        key: "indice_ip",
        label: "Indice IP",
        type: "select" as const,
        required: true,
        options: ["IP44", "IP67"],
      },
    ]
    const err = validateVariantsCustomData(columns, [
      { color: "Noir", size: "S", supplierPrice: 10, stock: 1, customData: { indice_ip: "IP44" } },
      { color: "Rouge", size: "M", supplierPrice: 10, stock: 1, customData: {} },
    ])
    expect(err).toMatch(/Ligne 2: champ Indice IP requis/)
  })

  it("builds duplicate column with unique key", () => {
    const source = {
      key: "matiere",
      label: "Matière",
      type: "text" as const,
      required: false,
    }
    const dup = buildDuplicateCustomColumn(source, ["matiere"])
    expect(dup.key).not.toBe("matiere")
    expect(dup.label).toContain("copie")
    expect(dup.type).toBe("text")
    const dup2 = buildDuplicateCustomColumn(source, ["matiere", dup.key])
    expect(dup2.key).not.toBe(dup.key)
  })

  it("parses customColumns from API body", () => {
    const parsed = parseCustomColumnsFromBody({
      customColumns: [
        {
          key: "matiere",
          label: "Matière",
          type: "text",
          required: false,
        },
      ],
    })
    expect(Array.isArray(parsed)).toBe(true)
    if (Array.isArray(parsed)) {
      expect(parsed[0]?.key).toBe("matiere")
    }
  })
})
