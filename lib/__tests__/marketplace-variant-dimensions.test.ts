import { describe, expect, it } from "vitest"

import {
  collectStorageOptionValues,
  findVariantRowForShopperSelection,
  resolveMarketplacePrimaryOptionNames,
} from "@/lib/marketplace-variant-dimensions"
import type { CustomColumn } from "@/types/product"

import { splitVariantLineName } from "@/lib/supplier-sku-builder"

describe("marketplace-variant-dimensions", () => {
  it("strips Color: prefix from variant row names", () => {
    expect(splitVariantLineName("Color: Rose haricot")).toEqual({
      color: "Rose haricot",
      size: null,
    })
  })

  const storageColumn: CustomColumn = {
    key: "storage_capacity",
    label: "Capacité stockage",
    type: "select",
    required: false,
    options: ["64 GB", "128 GB"],
  }

  it("collects storage from variant row attrs and custom column options", () => {
    expect(
      collectStorageOptionValues({
        variants: {
          variantRows: [
            {
              id: "1",
              name: "No HW kit",
              sku: "",
              priceCents: 20000,
              stock: 5,
              commission: 15,
              sales: 0,
              attrs: { storage_capacity: "64 GB" },
            },
            {
              id: "2",
              name: "With HW kit",
              sku: "",
              priceCents: 21000,
              stock: 3,
              commission: 15,
              sales: 0,
              attrs: { storage_capacity: "128 GB" },
            },
          ],
        },
        customColumns: [storageColumn],
      })
    ).toEqual(["64 GB", "128 GB"])
  })

  it("keeps HW kit as primary and removes storage duplicates from option list", () => {
    expect(
      resolveMarketplacePrimaryOptionNames(
        [],
        {
          variantRows: [
            {
              id: "1",
              name: "No HW kit",
              sku: "",
              priceCents: 0,
              stock: 1,
              commission: 15,
              sales: 0,
            },
            {
              id: "2",
              name: "With HW kit",
              sku: "",
              priceCents: 0,
              stock: 1,
              commission: 15,
              sales: 0,
            },
          ],
        },
        ["64 GB", "128 GB"]
      )
    ).toEqual(["No HW kit", "With HW kit"])
  })

  it("matches variant row by primary + storage", () => {
    const row = findVariantRowForShopperSelection({
      customColumns: [storageColumn],
      variants: {
        variantRows: [
          {
            id: "1",
            name: "No HW kit",
            sku: "",
            priceCents: 28186,
            stock: 2,
            commission: 15,
            sales: 0,
            attrs: { storage_capacity: "64 GB" },
          },
          {
            id: "2",
            name: "No HW kit",
            sku: "",
            priceCents: 29886,
            stock: 1,
            commission: 15,
            sales: 0,
            attrs: { storage_capacity: "128 GB" },
          },
        ],
      },
      selection: { selectedPrimary: "No HW kit", selectedStorage: "128 GB", selectedSize: null },
    })
    expect(row?.priceCents).toBe(29886)
    expect(row?.stock).toBe(1)
  })

  it("matches AE-style Color: labels against shopper selection", () => {
    const row = findVariantRowForShopperSelection({
      customColumns: [],
      variants: {
        variantRows: [
          {
            id: "1",
            name: "Color: Rose haricot",
            sku: "",
            priceCents: 1485,
            stock: 12,
            commission: 15,
            sales: 0,
          },
          {
            id: "2",
            name: "Color: Noir",
            sku: "",
            priceCents: 1485,
            stock: 8,
            commission: 15,
            sales: 0,
          },
        ],
      },
      selection: { selectedPrimary: "Rose haricot", selectedStorage: null, selectedSize: null },
    })
    expect(row?.name).toBe("Color: Rose haricot")
    expect(row?.stock).toBe(12)
  })
})
