import { AFFISELL_CATEGORIES } from "@/lib/affisell-categories"

/** Affisell marketplace category taxonomy (aligned with seed + marketplace filters). */
export const CATEGORIES = AFFISELL_CATEGORIES

export type CatalogColorSwatch = { name: string; hex: string; multicolor?: boolean }

export function isMulticolorSwatch(c: Pick<CatalogColorSwatch, "hex" | "multicolor">): boolean {
  return Boolean(c.multicolor || c.hex === "multicolor")
}

export const COLORS: CatalogColorSwatch[] = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Space Gray", hex: "#8E8E93" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Blue", hex: "#007AFF" },
  { name: "Midnight", hex: "#1D1D3A" },
  { name: "Red", hex: "#FF3B30" },
  { name: "Green", hex: "#34C759" },
  { name: "Pink", hex: "#FF2D92" },
  { name: "Purple", hex: "#AF52DE" },
  { name: "Yellow", hex: "#FFCC02" },
  { name: "Orange", hex: "#FF9500" },
  { name: "Brown", hex: "#A2845E" },
  { name: "Beige", hex: "#F5E6D3" },
  { name: "Turquoise", hex: "#5AC8FA" },
  { name: "Multicolor", hex: "multicolor" },
]

export type VariantGroupKey = "size" | "storage" | "ram" | "material"

export const VARIANT_GROUP_LABELS: Record<VariantGroupKey, string> = {
  size: "Size",
  storage: "Capacity / Storage",
  ram: "RAM",
  material: "Material",
}

export const VARIANT_PRESETS: Record<VariantGroupKey, string[]> = {
  size: ["XS", "S", "M", "L", "XL", "XXL", "32", "34", "36", "38", "40", "42", "44"],
  storage: ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB", "2 TB"],
  ram: ["4 GB", "8 GB", "16 GB", "32 GB"],
  material: ["Cotton", "Polyester", "Leather", "Metal", "Plastic", "Glass"],
}
