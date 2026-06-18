import { describe, expect, it } from "vitest"

import {
  colorForImageIndex,
  enrichGalleryWithColorHeroImages,
  findColorImageRowForName,
  imageIndexForColor,
  resolveColorHeroImageUrl,
  type ProductColorImageRow,
} from "@/lib/product-color-images"

const gallery = [
  "https://cdn.example/black.jpg",
  "https://cdn.example/blue.jpg",
  "https://cdn.example/green.jpg",
  "https://cdn.example/orange.jpg",
  "https://cdn.example/red.jpg",
]

const colorNames = ["Black", "Blue", "Green", "Orange", "Red"]

const colorImages: ProductColorImageRow[] = [
  { color: "Black", hex: "#000000", image: "https://cdn.example/black.jpg" },
  { color: "Blue", hex: "#0000ff", image: "https://cdn.example/blue.jpg" },
  { color: "Green", hex: "#00ff00", image: "https://cdn.example/green.jpg" },
  { color: "Orange", hex: "#ffa500", image: "https://cdn.example/orange.jpg" },
  { color: "Red", hex: "#ff0000", image: "https://cdn.example/red.jpg" },
]

describe("imageIndexForColor", () => {
  it("matches gallery index from per-color image URL", () => {
    expect(imageIndexForColor("Green", colorNames, colorImages, gallery)).toBe(2)
  })

  it("matches French color labels to English gallery rows", () => {
    expect(imageIndexForColor("Vert", colorNames, colorImages, gallery)).toBe(2)
  })

  it("prefers positional index when colorImages URL is mapped to another color", () => {
    const misMapped: ProductColorImageRow[] = colorImages.map((row) =>
      row.color === "Orange"
        ? { ...row, image: "https://cdn.example/green.jpg" }
        : row
    )
    expect(imageIndexForColor("Orange", colorNames, misMapped, gallery)).toBe(3)
    expect(imageIndexForColor("Green", colorNames, misMapped, gallery)).toBe(2)
  })

  it("skips a leading lifestyle image when gallery is longer than color list", () => {
    const lifestyleGallery = [
      "https://cdn.example/lifestyle.jpg",
      ...gallery,
    ]
    expect(imageIndexForColor("Green", colorNames, colorImages, lifestyleGallery)).toBe(3)
    expect(imageIndexForColor("Orange", colorNames, colorImages, lifestyleGallery)).toBe(4)
  })

  it("uses per-color URL when it is not in the main gallery", () => {
    const perColorOnly: ProductColorImageRow[] = [
      { color: "Blanc", hex: "#FFFFFF", image: "https://cdn.example/white-only.jpg" },
      { color: "Bleu Indigo", hex: "#4F46E5", image: "https://cdn.example/indigo-only.jpg" },
    ]
    const names = ["Blanc", "Bleu Indigo", "Noir transparent"]
    const lifestyleGallery = [
      "https://cdn.example/lifestyle.jpg",
      "https://cdn.example/spec-chip.jpg",
      "https://cdn.example/battery.jpg",
    ]
    const enriched = enrichGalleryWithColorHeroImages(lifestyleGallery, names, [
      ...perColorOnly,
      { color: "Noir transparent", hex: "#1C1C1E", image: "https://cdn.example/black-only.jpg" },
    ])
    expect(resolveColorHeroImageUrl("Bleu Indigo", names, perColorOnly, lifestyleGallery)).toBe(
      "https://cdn.example/indigo-only.jpg"
    )
    expect(imageIndexForColor("Bleu Indigo", names, perColorOnly, enriched)).toBeGreaterThanOrEqual(0)
  })
})

describe("colorForImageIndex", () => {
  it("reverse-maps gallery index to color name", () => {
    expect(colorForImageIndex(1, colorNames, colorImages, gallery)).toBe("Blue")
  })

  it("keeps color + thumbnail in sync when shopper picks another swatch", () => {
    const greenIndex = imageIndexForColor("Green", colorNames, colorImages, gallery)
    expect(colorForImageIndex(greenIndex, colorNames, colorImages, gallery)).toBe("Green")
  })
})

describe("findColorImageRowForName", () => {
  it("matches color aliases across locales", () => {
    expect(findColorImageRowForName(colorImages, "Bleu")?.color).toBe("Blue")
  })
})
