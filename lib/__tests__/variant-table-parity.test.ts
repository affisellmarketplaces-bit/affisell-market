/**
 * Founder brief 2026-11-19 (« retour en stock » §1): variants kept in the separate `ProductVariant` table must be judged
 * by the server (checkout check, cards, assistant, « Prévenez-moi au retour ») under EXACTLY the names and stocks the
 * product page and the reseller boutique show (`variantsWithProductVariantRows`). Otherwise a choice the page offers
 * is « unknown » to the server, or a variant the page shows as available is waited for.
 */
import { describe, expect, it } from "vitest"

import { variantsWithProductVariantRows } from "@/lib/marketplace-variant-dimensions"
import { parseCustomColumnsFromDb } from "@/lib/product-custom-columns"
import { optionStockForChoice, resolveVariantChoice, variantRowDimensions, variantsFromTable } from "@/lib/variant-selection"

const storageCols = [{ key: "stockage", label: "Stockage", type: "text" }]
type T = { color: string | null; size: string | null; stock: number; customData?: unknown }
const shapes: Record<string, { table: T[]; cols: unknown }> = {
  "colour × size": { table: [{ color: "Noir", size: "M", stock: 0 }, { color: "Noir", size: "L", stock: 3 }, { color: "Blanc", size: "M", stock: 2 }], cols: null },
  "size only": { table: [{ color: null, size: "M", stock: 0 }, { color: null, size: "L", stock: 4 }], cols: null },
  "colour only": { table: [{ color: "Rouge", size: null, stock: 1 }, { color: "Vert", size: null, stock: 0 }], cols: null },
  "colour × capacity": {
    table: [
      { color: "Noir", size: null, stock: 0, customData: { stockage: "128 Go" } },
      { color: "Noir", size: null, stock: 5, customData: { stockage: "256 Go" } },
    ],
    cols: storageCols,
  },
  "capacity only": {
    table: [
      { color: null, size: null, stock: 0, customData: { stockage: "128 Go" } },
      { color: null, size: null, stock: 2, customData: { stockage: "256 Go" } },
    ],
    cols: storageCols,
  },
}

function pageRows(table: T[], cols: unknown) {
  const parsed = parseCustomColumnsFromDb(cols)
  return variantsWithProductVariantRows(
    null,
    table.map((v, i) => ({ id: `v${i}`, color: v.color, size: v.size, stock: v.stock, supplierPrice: 10, customData: v.customData })),
    parsed,
    1000
  )
}

describe("table variants — the server reads what the page shows", () => {
  for (const [label, { table, cols }] of Object.entries(shapes)) {
    it(`${label}: same names, same stock, same dimensions`, () => {
      const page = pageRows(table, cols)!.variantRows!
      const server = variantsFromTable(table, cols)!.variantRows
      expect(server.map((r) => r.name)).toEqual(page.map((r) => r.name))
      expect(server.map((r) => r.stock)).toEqual(page.map((r) => r.stock))
      expect(variantRowDimensions(variantsFromTable(table, cols), cols)).toEqual(variantRowDimensions(pageRows(table, cols), cols))
    })

    it(`${label}: every row the page offers resolves to that same row on the server, with its stock`, () => {
      const page = pageRows(table, cols)!
      const dims = variantRowDimensions(page, cols)
      dims.forEach((d, i) => {
        const choice = { color: d.color || null, size: d.size || null, storage: d.storage || null }
        const onPage = resolveVariantChoice(page, choice, cols)
        const onServer = resolveVariantChoice(variantsFromTable(table, cols), choice, cols)
        expect(onServer).toEqual(onPage)
        expect(onServer).toMatchObject({ kind: "resolved", index: i })
        expect(optionStockForChoice(variantsFromTable(table, cols), choice, cols)).toBe(table[i]!.stock)
      })
    })
  }
})
