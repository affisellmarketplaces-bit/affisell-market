import {
  PRODUCT_VISION_V2_CONFIDENCE_THRESHOLD,
  PRODUCT_VISION_V2_SYSTEM_PROMPT,
} from "@/lib/ai/product-vision-v2-config"

export type ProductVisionV2Raw = {
  title: string
  description: string
  category: string
  attributes: Record<string, string>
  suggestedPrice: number | null
  confidence: number
  productType: string
  detectedBrand: string | null
  detectedModel: string | null
}

const ACCESSORY_TITLE_PATTERN =
  /\b(coque|étui|etui|housse|case|cover|bumper|screen protector|protecteur|film|verre trempé)\b/i

const DEVICE_PRODUCT_TYPES_REQUIRING_MODEL = new Set(["smartphone", "tablet"])

export function stripJsonFence(s: string): string {
  const t = s.trim()
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }
  return t
}

export function parseVisionV2Payload(raw: string): ProductVisionV2Raw {
  const empty: ProductVisionV2Raw = {
    title: "",
    description: "",
    category: "",
    attributes: {},
    suggestedPrice: null,
    confidence: 0,
    productType: "other",
    detectedBrand: null,
    detectedModel: null,
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(raw))
  } catch {
    return empty
  }

  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  const title = typeof o.title === "string" ? o.title.trim() : ""
  const description = typeof o.description === "string" ? o.description.trim() : ""
  const category = typeof o.category === "string" ? o.category.trim() : ""
  const productType = typeof o.productType === "string" ? o.productType.trim().toLowerCase() : "other"
  const detectedBrand = typeof o.detectedBrand === "string" ? o.detectedBrand.trim() : null
  const detectedModel = typeof o.detectedModel === "string" ? o.detectedModel.trim() : null

  const suggestedPrice =
    typeof o.suggestedPrice === "number" && Number.isFinite(o.suggestedPrice)
      ? o.suggestedPrice
      : Number.isFinite(Number(o.suggestedPrice))
        ? Number(o.suggestedPrice)
        : null

  let confidence = typeof o.confidence === "number" && Number.isFinite(o.confidence) ? o.confidence : 0.5
  confidence = Math.max(0, Math.min(1, confidence))

  const attributes: Record<string, string> = {}
  if (o.attributes && typeof o.attributes === "object" && !Array.isArray(o.attributes)) {
    for (const [k, v] of Object.entries(o.attributes as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) attributes[k] = v.trim()
    }
  }

  return {
    title,
    description,
    category,
    attributes,
    suggestedPrice,
    confidence,
    productType,
    detectedBrand,
    detectedModel,
  }
}

/** Penalize common hallucinations (device mislabeled as accessory, empty title, etc.). */
export function auditProductVisionConfidence(raw: ProductVisionV2Raw): number {
  let confidence = raw.confidence

  if (!raw.title.trim()) confidence = Math.min(confidence, 0.2)
  if (
    !raw.detectedModel?.trim() &&
    DEVICE_PRODUCT_TYPES_REQUIRING_MODEL.has(raw.productType)
  ) {
    confidence = Math.min(confidence, 0.65)
  }

  const titleLower = raw.title.toLowerCase()
  const isDeviceType = raw.productType === "smartphone" || raw.productType === "tablet"
  if (isDeviceType && ACCESSORY_TITLE_PATTERN.test(titleLower)) {
    confidence = Math.min(confidence, 0.35)
  }

  if (raw.productType === "accessory" && !ACCESSORY_TITLE_PATTERN.test(titleLower)) {
    confidence = Math.min(confidence, 0.75)
  }

  return Math.max(0, Math.min(1, confidence))
}

export function shouldRequireManualFallback(
  confidence: number,
  threshold = PRODUCT_VISION_V2_CONFIDENCE_THRESHOLD
): boolean {
  return confidence < threshold
}

/** Hard "incertain" only when nothing usable was extracted — not merely low confidence. */
export function hasUsableVisionExtraction(raw: Pick<ProductVisionV2Raw, "title" | "suggestedPrice">): boolean {
  return Boolean(raw.title.trim()) || (raw.suggestedPrice != null && Number.isFinite(raw.suggestedPrice))
}

export function buildVisionV2UserPrompt(): string {
  return `${PRODUCT_VISION_V2_SYSTEM_PROMPT}

Analyse l'image produit fournie et remplis le JSON.`
}
