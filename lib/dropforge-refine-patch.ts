import { DROPFORGE_MAX_DESC, DROPFORGE_MAX_IMAGES } from "@/lib/dropforge-complete-import"
import { absolutizeCdnImageUrl } from "@/lib/cdn-image-url"

/** Patch operations — applied on top of existing preview (no re-scrape). */
export type DropForgeRefinePatch = {
  title?: string
  description?: string
  brand?: string
  category?: string
  costPrice?: number
  addImages?: string[]
  removeImageIndexes?: number[]
  addColors?: Array<{ name: string; hex?: string; image?: string }>
  addSizes?: string[]
  addSpecs?: Record<string, string>
  addVariants?: Array<{
    name: string
    type?: string
    price?: number
    stock?: number
    sku?: string
    image?: string
    attributes?: Record<string, string>
  }>
  addTags?: string[]
}

export type DropForgePatchablePreview = {
  title: string
  description: string
  images: string[]
  videos?: string[]
  variants?: Array<{
    name: string
    type?: string
    image?: string
    price?: number
    stock?: number
    sku?: string
    attributes?: Record<string, string>
  }>
  colors?: Array<{ name: string; image?: string; hex?: string }>
  sizes?: string[]
  specs?: Record<string, string>
  tags?: string[]
  brand?: string
  category?: string
  costPrice?: number
  suggestedPrice?: number
  profitPerSale?: number
  warnings?: string[]
}

function uniqueHttpsImages(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const abs = absolutizeCdnImageUrl(raw) ?? raw
    if (!/^https?:\/\//i.test(abs) || seen.has(abs)) continue
    seen.add(abs)
    out.push(abs)
    if (out.length >= DROPFORGE_MAX_IMAGES) break
  }
  return out
}

export function applyDropForgeRefinePatch<T extends DropForgePatchablePreview>(
  preview: T,
  patch: DropForgeRefinePatch
): { preview: T; applied: string[] } {
  const applied: string[] = []
  const next: DropForgePatchablePreview = { ...preview }

  if (patch.title?.trim() && patch.title.trim() !== preview.title) {
    next.title = patch.title.trim().slice(0, 200)
    applied.push("title")
  }

  if (patch.description?.trim() && patch.description.trim() !== preview.description) {
    next.description = patch.description.trim().slice(0, DROPFORGE_MAX_DESC)
    applied.push("description")
  }

  if (patch.brand?.trim()) {
    next.brand = patch.brand.trim().slice(0, 48)
    applied.push("brand")
  }

  if (patch.category?.trim()) {
    next.category = patch.category.trim().slice(0, 120)
    applied.push("category")
  }

  if (
    typeof patch.costPrice === "number" &&
    Number.isFinite(patch.costPrice) &&
    patch.costPrice > 0 &&
    patch.costPrice !== preview.costPrice
  ) {
    next.costPrice = Number(patch.costPrice.toFixed(2))
    if (typeof preview.suggestedPrice === "number" && preview.suggestedPrice > 0) {
      next.suggestedPrice = preview.suggestedPrice
      next.profitPerSale = Math.max(
        0,
        Number((preview.suggestedPrice - next.costPrice).toFixed(2))
      )
    }
    applied.push("costPrice")
  }

  let images = [...(preview.images ?? [])]
  if (patch.removeImageIndexes?.length) {
    const remove = new Set(
      patch.removeImageIndexes.filter((i) => Number.isInteger(i) && i >= 0 && i < images.length)
    )
    if (remove.size > 0) {
      images = images.filter((_, i) => !remove.has(i))
      applied.push("removeImages")
    }
  }
  if (patch.addImages?.length) {
    const merged = uniqueHttpsImages([...images, ...patch.addImages])
    if (merged.length > images.length) {
      images = merged
      applied.push("addImages")
    }
  }
  next.images = images

  const specs = { ...(preview.specs ?? {}) }
  if (patch.addSpecs) {
    let added = 0
    for (const [k, v] of Object.entries(patch.addSpecs)) {
      if (!v?.trim() || specs[k]) continue
      specs[k.slice(0, 80)] = v.trim().slice(0, 500)
      added += 1
    }
    if (added > 0) {
      next.specs = specs
      applied.push("specs")
    }
  }

  const sizes = [...(preview.sizes ?? [])]
  if (patch.addSizes?.length) {
    const seen = new Set(sizes.map((s) => s.toLowerCase()))
    for (const s of patch.addSizes) {
      const t = s.trim().slice(0, 40)
      if (!t || seen.has(t.toLowerCase())) continue
      seen.add(t.toLowerCase())
      sizes.push(t)
    }
    if (sizes.length > (preview.sizes?.length ?? 0)) {
      next.sizes = sizes.slice(0, 40)
      applied.push("sizes")
    }
  }

  const colors = [...(preview.colors ?? [])]
  if (patch.addColors?.length) {
    const seen = new Set(colors.map((c) => c.name.toLowerCase()))
    for (const c of patch.addColors) {
      const name = c.name.trim().slice(0, 48)
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      colors.push({
        name,
        hex: c.hex?.trim().slice(0, 7) ?? "",
        image: c.image ? absolutizeCdnImageUrl(c.image) ?? c.image : "",
      })
    }
    if (colors.length > (preview.colors?.length ?? 0)) {
      next.colors = colors.slice(0, 24)
      applied.push("colors")
    }
  }

  const variants = [...(preview.variants ?? [])]
  if (patch.addVariants?.length) {
    const seen = new Set(variants.map((v) => v.name.toLowerCase()))
    for (const v of patch.addVariants) {
      const name = v.name.trim().slice(0, 120)
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      variants.push({
        name,
        type: v.type?.trim().slice(0, 64) ?? "Variant",
        image: v.image ? absolutizeCdnImageUrl(v.image) ?? v.image : "",
        price: typeof v.price === "number" && v.price > 0 ? v.price : preview.costPrice ?? 0,
        stock: typeof v.stock === "number" && v.stock >= 0 ? Math.round(v.stock) : 0,
        sku: v.sku?.trim().slice(0, 64) ?? "",
        attributes: v.attributes ?? {},
      })
    }
    if (variants.length > (preview.variants?.length ?? 0)) {
      next.variants = variants.slice(0, 120)
      applied.push("variants")
    }
  }

  if (patch.addTags?.length) {
    const tags = [...(preview.tags ?? [])]
    const seen = new Set(tags.map((t) => t.toLowerCase()))
    for (const t of patch.addTags) {
      const slug = t.trim().toLowerCase().slice(0, 40)
      if (!slug || seen.has(slug)) continue
      seen.add(slug)
      tags.push(slug)
    }
    if (tags.length > (preview.tags?.length ?? 0)) {
      next.tags = tags.slice(0, 12)
      applied.push("tags")
    }
  }

  return { preview: { ...preview, ...next } as T, applied }
}
