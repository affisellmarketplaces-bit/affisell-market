export type ProductDescriptionAiInput = {
  name: string
  supplierPriceEur: number
  images: string[]
  specs: {
    material?: string
    dimensions?: string
    extra?: Array<{ label: string; value: string }>
  }
  categoryPath?: string
}

export type ProductDescriptionAiResult = {
  seoTitle: string
  accroche: string
  benefices: string[]
  storytelling: string
  specs: Array<{ label: string; value: string }>
  faq: Array<{ q: string; a: string }>
}

export function formatAffiliateListingDescriptionFromAi(result: ProductDescriptionAiResult): string {
  const lines: string[] = [result.accroche, "", result.storytelling, "", "CE QUE TU GAGNES"]
  for (const b of result.benefices) lines.push(`• ${b}`)

  if (result.specs.length > 0) {
    lines.push("", "CARACTÉRISTIQUES")
    for (const s of result.specs) lines.push(`${s.label} : ${s.value}`)
  }

  if (result.faq.length > 0) {
    lines.push("", "FAQ")
    for (const f of result.faq) {
      lines.push("", f.q, f.a)
    }
  }

  return lines.join("\n").trim()
}

export function extractMaterialAndDimensions(
  attributes: Array<{ key: string; label: string; value: string }>
): { material?: string; dimensions?: string; extra: Array<{ label: string; value: string }> } {
  let material: string | undefined
  let dimensions: string | undefined
  const extra: Array<{ label: string; value: string }> = []

  for (const a of attributes) {
    const key = a.key.toLowerCase()
    const label = a.label.trim()
    const value = a.value.trim()
    if (!value) continue

    if (/material|materiau|matiere|composition/.test(key) || /material|matériau|composition/i.test(label)) {
      material = value
      continue
    }
    if (/dimension|size|taille|largeur|hauteur/.test(key) || /dimension|taille/i.test(label)) {
      dimensions = value
      continue
    }
    extra.push({ label: label || a.key, value })
  }

  return { material, dimensions, extra }
}

export function resolveSupplierPriceEur(product: {
  basePriceCents: number
  productVariants?: Array<{ supplierPrice: { toString(): string } }>
}): number {
  const variants = product.productVariants ?? []
  if (variants.length > 0) {
    const prices = variants
      .map((v) => Number(v.supplierPrice))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (prices.length > 0) return Math.min(...prices)
  }
  return product.basePriceCents / 100
}
