import { Prisma } from "@prisma/client"
import { z } from "zod"

import { resolveColorSwatchMeta } from "@/lib/color-name-hex"
import { trimColorSwatchImageForStore } from "@/lib/color-swatch-store"
import {
  findColorImageRowForName,
  parseProductColorImagesFromDb,
  type ProductColorImageRow,
} from "@/lib/product-color-images"
import { VARIANT_COLOR_REGEX } from "@/lib/supplier-sku-builder"

export const adminVariantEditRowSchema = z.object({
  id: z.string().min(1),
  color: z.string().max(32).optional(),
  size: z.string().max(16).nullable().optional(),
  wholesalePriceCents: z.number().int().min(0).max(10_000_000).optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  /** HTTPS / data URL; empty string clears the color hero */
  imageUrl: z.string().max(500_000).nullable().optional(),
})

export const adminVariantEditsBodySchema = z.object({
  variants: z.array(adminVariantEditRowSchema).min(1).max(120),
})

export type AdminVariantEditRow = z.infer<typeof adminVariantEditRowSchema>

function sanitizeColorName(raw: string, fallback: string): string {
  let c = raw
    .trim()
    .replace(/[,+]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 32)
  if (!c || !VARIANT_COLOR_REGEX.test(c)) {
    c = fallback.replace(/[,+]+/g, " ").trim().slice(0, 32) || "Variant"
  }
  if (!VARIANT_COLOR_REGEX.test(c)) {
    c = `V${Math.abs(hashStr(fallback)) % 997}`
  }
  return c.slice(0, 32)
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

function readCustomImage(customData: unknown): string {
  if (!customData || typeof customData !== "object" || Array.isArray(customData)) return ""
  const img = (customData as Record<string, unknown>).image
  return typeof img === "string" ? img.trim() : ""
}

function mergeCustomDataImage(
  customData: unknown,
  image: string
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const base: Record<string, string | number | boolean> = {}
  if (customData && typeof customData === "object" && !Array.isArray(customData)) {
    for (const [k, v] of Object.entries(customData as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        base[k] = v
      }
    }
  }
  if (image) base.image = image
  else delete base.image
  return Object.keys(base).length > 0 ? (base as Prisma.InputJsonValue) : Prisma.DbNull
}

/**
 * Idempotent merge of admin variant edits into colorImages + per-row DB patches.
 * Does not touch AffiliateProduct pricing.
 */
export function buildAdminVariantEditPlan(input: {
  existing: Array<{
    id: string
    color: string | null
    size: string | null
    wholesalePriceCents: number | null
    supplierPrice: Prisma.Decimal | number | string
    publicPrice: Prisma.Decimal | number | string
    stock: number
    customData: unknown
  }>
  edits: AdminVariantEditRow[]
  colorImagesJson: unknown
  galleryImages: string[]
}): {
  ok: true
  colorImages: ProductColorImageRow[]
  colors: string[]
  galleryImages: string[]
  updates: Array<{
    id: string
    data: {
      color?: string
      size?: string | null
      wholesalePriceCents?: number
      supplierPrice?: Prisma.Decimal
      publicPrice?: Prisma.Decimal
      stock?: number
      customData?: Prisma.InputJsonValue | typeof Prisma.DbNull
    }
  }>
  changed: boolean
} | { ok: false; error: string } {
  const byId = new Map(input.existing.map((v) => [v.id, v]))
  for (const edit of input.edits) {
    if (!byId.has(edit.id)) {
      return { ok: false, error: `variant_not_found:${edit.id}` }
    }
  }

  let colorImages =
    parseProductColorImagesFromDb(input.colorImagesJson)?.map((r) => ({ ...r })) ?? []
  const gallery = [...input.galleryImages]
  const gallerySeen = new Set(
    gallery.map((u) => u.trim().toLowerCase()).filter(Boolean)
  )
  const updates: Array<{
    id: string
    data: {
      color?: string
      size?: string | null
      wholesalePriceCents?: number
      supplierPrice?: Prisma.Decimal
      publicPrice?: Prisma.Decimal
      stock?: number
      customData?: Prisma.InputJsonValue | typeof Prisma.DbNull
    }
  }> = []
  let changed = false

  const upsertColorImage = (colorName: string, image: string | undefined) => {
    if (image === undefined) return
    const trimmed = trimColorSwatchImageForStore(image)
    const existing = findColorImageRowForName(colorImages, colorName)
    if (existing) {
      if (existing.image !== trimmed) {
        existing.image = trimmed
        changed = true
      }
    } else {
      colorImages.push({
        color: colorName,
        hex: resolveColorSwatchMeta(colorName).hex,
        image: trimmed,
      })
      changed = true
    }
    if (trimmed && /^https?:\/\//i.test(trimmed) && !gallerySeen.has(trimmed.toLowerCase())) {
      if (gallery.length < 24) {
        gallery.push(trimmed)
        gallerySeen.add(trimmed.toLowerCase())
        changed = true
      }
    }
  }

  const renameColorImageKey = (from: string, to: string) => {
    if (from.toLowerCase() === to.toLowerCase()) return
    const row = findColorImageRowForName(colorImages, from)
    if (!row) return
    const dest = findColorImageRowForName(colorImages, to)
    if (dest) {
      if (!dest.image && row.image) dest.image = row.image
      colorImages = colorImages.filter((r) => r.color.toLowerCase() !== from.toLowerCase())
    } else {
      row.color = to
      row.hex = resolveColorSwatchMeta(to).hex
    }
    changed = true
  }

  for (const edit of input.edits) {
    const cur = byId.get(edit.id)!
    const data: (typeof updates)[number]["data"] = {}
    const prevColor = (cur.color ?? "").trim() || "Variant"
    let nextColor = prevColor

    if (edit.color !== undefined) {
      nextColor = sanitizeColorName(edit.color, prevColor)
      if (nextColor !== (cur.color ?? "")) {
        data.color = nextColor
        renameColorImageKey(prevColor, nextColor)
      }
    }

    if (edit.size !== undefined) {
      const nextSize = edit.size?.trim() ? edit.size.trim().slice(0, 16) : null
      if (nextSize !== cur.size) data.size = nextSize
    }

    if (edit.wholesalePriceCents !== undefined) {
      const cents = edit.wholesalePriceCents
      if (cents !== (cur.wholesalePriceCents ?? -1)) {
        data.wholesalePriceCents = cents
        data.supplierPrice = new Prisma.Decimal(cents / 100)
        data.publicPrice = new Prisma.Decimal(Math.round(cents * 1.35) / 100)
      }
    }

    if (edit.stock !== undefined && edit.stock !== cur.stock) {
      data.stock = edit.stock
    }

    if (edit.imageUrl !== undefined) {
      const nextImg = trimColorSwatchImageForStore(edit.imageUrl?.trim() || "")
      const prevImg = readCustomImage(cur.customData)
      if (nextImg !== prevImg) {
        data.customData = mergeCustomDataImage(cur.customData, nextImg)
      }
      upsertColorImage(nextColor, nextImg)
    }

    if (Object.keys(data).length > 0) {
      updates.push({ id: edit.id, data })
      changed = true
    }
  }

  const colors = Array.from(
    new Set(
      input.existing.map((v) => {
        const edited = input.edits.find((e) => e.id === v.id)
        if (edited?.color !== undefined) {
          return sanitizeColorName(edited.color, v.color ?? "Variant")
        }
        return (v.color ?? "").trim() || "Variant"
      })
    )
  )

  return {
    ok: true,
    colorImages,
    colors,
    galleryImages: gallery,
    updates,
    changed,
  }
}
