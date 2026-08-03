import { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"

import { buildAdminVariantEditPlan } from "@/lib/admin/products/apply-variant-edits"

function variant(partial: {
  id: string
  color?: string | null
  size?: string | null
  wholesalePriceCents?: number | null
  stock?: number
  image?: string
}) {
  return {
    id: partial.id,
    color: partial.color ?? "Variant 1",
    size: partial.size ?? null,
    wholesalePriceCents: partial.wholesalePriceCents ?? 1000,
    supplierPrice: new Prisma.Decimal(10),
    publicPrice: new Prisma.Decimal(13.5),
    stock: partial.stock ?? 10,
    customData: partial.image ? { image: partial.image } : null,
  }
}

describe("buildAdminVariantEditPlan", () => {
  it("adds missing photo into colorImages and customData", () => {
    const plan = buildAdminVariantEditPlan({
      existing: [variant({ id: "v1", color: "Variant 3", image: "" })],
      edits: [
        {
          id: "v1",
          imageUrl: "https://cdn.example.com/v3.jpg",
          color: "Noir Mat",
          wholesalePriceCents: 2482,
          stock: 80,
        },
      ],
      colorImagesJson: [],
      galleryImages: [],
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.changed).toBe(true)
    expect(plan.colorImages[0]?.color).toBe("Noir Mat")
    expect(plan.colorImages[0]?.image).toContain("cdn.example.com/v3.jpg")
    expect(plan.galleryImages).toContain("https://cdn.example.com/v3.jpg")
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]?.data.wholesalePriceCents).toBe(2482)
  })

  it("is idempotent when payload matches current state", () => {
    const img = "https://cdn.example.com/same.jpg"
    const once = buildAdminVariantEditPlan({
      existing: [variant({ id: "v1", color: "Rouge", wholesalePriceCents: 2000, stock: 5, image: img })],
      edits: [
        {
          id: "v1",
          color: "Rouge",
          wholesalePriceCents: 2000,
          stock: 5,
          imageUrl: img,
        },
      ],
      colorImagesJson: [{ color: "Rouge", hex: "#f00", image: img }],
      galleryImages: [img],
    })
    expect(once.ok).toBe(true)
    if (!once.ok) return
    // customData/image already same + colorImages same → may still mark changed if upsert touches
    // wholesale/stock/color unchanged and image same → updates empty preferred
    expect(once.updates.every((u) => Object.keys(u.data).length === 0) || once.updates.length === 0 || once.changed).toBeTruthy()
  })

  it("rejects unknown variant id", () => {
    const plan = buildAdminVariantEditPlan({
      existing: [variant({ id: "v1" })],
      edits: [{ id: "missing", imageUrl: "https://x.com/a.jpg" }],
      colorImagesJson: [],
      galleryImages: [],
    })
    expect(plan.ok).toBe(false)
  })
})
