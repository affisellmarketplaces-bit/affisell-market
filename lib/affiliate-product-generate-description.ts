import OpenAI from "openai"

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

const SYSTEM_PROMPT =
  "Tu es copywriter e-commerce. Transforme toujours les features en bénéfices. Ton style : direct, phrases courtes, tutoiement. Objectif : conversion."

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null
  return new OpenAI({ apiKey: key })
}

function stripJsonFence(s: string): string {
  const t = s.trim()
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }
  return t
}

function clampText(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return t.slice(0, max).trimEnd()
}

function normalizeBenefices(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function normalizeSpecs(raw: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ label: string; value: string }> = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const label = typeof o.label === "string" ? o.label.trim() : ""
    const value = typeof o.value === "string" ? o.value.trim() : ""
    if (label && value) out.push({ label, value })
  }
  return out.slice(0, 12)
}

function normalizeFaq(raw: unknown): Array<{ q: string; a: string }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ q: string; a: string }> = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const q = typeof o.q === "string" ? o.q.trim() : ""
    const a = typeof o.a === "string" ? o.a.trim() : ""
    if (q && a) out.push({ q, a })
  }
  return out.slice(0, 6)
}

export function parseProductDescriptionAiPayload(raw: unknown): ProductDescriptionAiResult | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const seoTitle = typeof o.seoTitle === "string" ? o.seoTitle.trim() : ""
  const accroche = typeof o.accroche === "string" ? o.accroche.trim() : ""
  const storytelling = typeof o.storytelling === "string" ? o.storytelling.trim() : ""
  if (!seoTitle || !accroche || !storytelling) return null

  return {
    seoTitle: clampText(seoTitle, 60),
    accroche: clampText(accroche, 150),
    benefices: normalizeBenefices(o.benefices),
    storytelling: clampText(storytelling, 400),
    specs: normalizeSpecs(o.specs),
    faq: normalizeFaq(o.faq),
  }
}

export function buildProductDescriptionAiUserPrompt(input: ProductDescriptionAiInput): string {
  const specLines: string[] = []
  if (input.specs.material?.trim()) specLines.push(`Matériau: ${input.specs.material.trim()}`)
  if (input.specs.dimensions?.trim()) specLines.push(`Dimensions: ${input.specs.dimensions.trim()}`)
  for (const row of input.specs.extra ?? []) {
    if (row.label.trim() && row.value.trim()) {
      specLines.push(`${row.label.trim()}: ${row.value.trim()}`)
    }
  }

  return [
    "Produit à rédiger (JSON de sortie uniquement, en français):",
    "",
    `Nom: ${input.name}`,
    `Prix fournisseur HT: ${input.supplierPriceEur.toFixed(2)} €`,
    input.categoryPath ? `Contexte rayon (ton seulement): ${input.categoryPath}` : "",
    input.images.length ? `Photos disponibles: ${input.images.length}` : "",
    specLines.length ? `Specs source:\n${specLines.map((l) => `- ${l}`).join("\n")}` : "",
    "",
    "Format JSON strict:",
    `{`,
    `  "seoTitle": "string max 60 caractères",`,
    `  "accroche": "bénéfice principal max 150 caractères",`,
    `  "benefices": ["bullet 1", "bullet 2", "bullet 3"],`,
    `  "storytelling": "paragraphe narratif max 400 caractères",`,
    `  "specs": [{"label": "Dimensions", "value": "L120 x P40 x H80"}],`,
    `  "faq": [{"q": "Question client ?", "a": "Réponse rassurante courte"}]`,
    `}`,
    "",
    "Règles:",
    "- 3 à 5 benefices, features → bénéfices client.",
    "- 2 à 4 FAQ réalistes (livraison, usage, entretien…).",
    "- specs: reprendre et enrichir les specs source sans inventer de certifications.",
    "- Tutoiement, phrases courtes, orienté conversion.",
  ]
    .filter(Boolean)
    .join("\n")
}

export async function generateProductDescriptionWithGpt4o(
  input: ProductDescriptionAiInput
): Promise<ProductDescriptionAiResult> {
  const client = getOpenAI()
  if (!client) {
    throw new Error("IA indisponible (OPENAI_API_KEY manquante).")
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.55,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildProductDescriptionAiUserPrompt(input) },
    ],
  })

  const raw = completion.choices[0]?.message?.content?.trim() ?? ""
  if (!raw) throw new Error("Réponse IA vide")

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(raw))
  } catch {
    throw new Error("Réponse IA invalide")
  }

  const result = parseProductDescriptionAiPayload(parsed)
  if (!result) throw new Error("Format IA incomplet")

  if (result.benefices.length < 2) {
    throw new Error("Benefices insuffisants dans la réponse IA")
  }

  return result
}

/** Compose listing description from AI blocks (does not affect category engine). */
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
