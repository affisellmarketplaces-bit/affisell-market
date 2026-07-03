import { groqChatText } from "@/lib/ai/groq-client"
import { newVariantRowId } from "@/lib/product-variants"
import {
  fillMissingVariantSkus,
  generateSkuTableRowsFromSetup,
  parseCommaList,
  suggestVariantSkuFromRow,
  VARIANT_COLOR_REGEX,
  type SupplierSkuTableRow,
} from "@/lib/supplier-sku-builder"
import {
  SIMPLE_COLOR_NAME_MAX,
  validateSimpleColorName,
} from "@/lib/supplier-simple-color-validation"

export type GenerateVariantsCharDef = {
  key: string
  label: string
  type: string
  options: string[]
  required: boolean
}

export type GenerateVariantsInput = {
  prompt: string
  title: string
  description: string
  categoryPath: string
  bullets: string[]
  basePriceEur: number
  defaultCommission: number
  skuPrefix?: string
  characteristics: GenerateVariantsCharDef[]
}

export type GeneratedColorRow = {
  name: string
  hex: string | null
}

export type GeneratedAdvancedRow = {
  color: string
  size: string | null
  sku: string | null
  supplierPriceEur: number | null
  stock: number | null
}

export type GenerateVariantsResult = {
  variantMode: "simple" | "advanced" | "none"
  sizesText: string
  colors: GeneratedColorRow[]
  specs: Record<string, string>
  advancedRows: GeneratedAdvancedRow[]
  summary: string
}

export type VariantComposerFormPatch = {
  variantMode: "simple" | "advanced" | "none"
  sizesText: string
  simpleColors: Array<{ id: string; name: string; image: string }>
  advancedSkuRows: SupplierSkuTableRow[]
  specValuesPatch: Record<string, string>
}

type AiGeneratePayload = {
  variantMode?: string
  sizesText?: string
  sizes?: string[]
  colors?: Array<{ name?: string; hex?: string | null }>
  specs?: Record<string, unknown>
  advancedRows?: Array<{
    color?: string
    size?: string | null
    sku?: string | null
    supplierPriceEur?: number | null
    stock?: number | null
  }>
  summary?: string
}

const PROMPT_MAX = 2400

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fence?.[1]) return JSON.parse(fence[1].trim()) as unknown
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as unknown
    throw new Error("Réponse IA invalide.")
  }
}

function sanitizeColorName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, SIMPLE_COLOR_NAME_MAX)
}

function sanitizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null
  const t = value.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t.toUpperCase()
  return null
}

function sanitizeSku(value: unknown): string | null {
  if (typeof value !== "string") return null
  const t = value.trim().replace(/\s+/g, "-").slice(0, 64)
  return t.length > 0 ? t : null
}

function normalizeSizesText(payload: AiGeneratePayload): string {
  if (typeof payload.sizesText === "string" && payload.sizesText.trim()) {
    return parseCommaList(payload.sizesText, 24).join(", ")
  }
  if (Array.isArray(payload.sizes)) {
    const list = payload.sizes
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean)
    if (list.length > 0) return parseCommaList(list.join(", "), 24).join(", ")
  }
  return ""
}

function normalizeColors(payload: AiGeneratePayload): GeneratedColorRow[] {
  if (!Array.isArray(payload.colors)) return []
  const seen = new Set<string>()
  const out: GeneratedColorRow[] = []
  for (const row of payload.colors) {
    if (!row || typeof row !== "object") continue
    const name = sanitizeColorName(typeof row.name === "string" ? row.name : "")
    if (!name || validateSimpleColorName(name)) continue
    if (!VARIANT_COLOR_REGEX.test(name)) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, hex: sanitizeHex(row.hex) })
    if (out.length >= 24) break
  }
  return out
}

function normalizeAdvancedRows(payload: AiGeneratePayload): GeneratedAdvancedRow[] {
  if (!Array.isArray(payload.advancedRows)) return []
  const out: GeneratedAdvancedRow[] = []
  for (const row of payload.advancedRows) {
    if (!row || typeof row !== "object") continue
    const color = sanitizeColorName(typeof row.color === "string" ? row.color : "")
    if (!color || validateSimpleColorName(color) || !VARIANT_COLOR_REGEX.test(color)) continue
    const sizeRaw =
      row.size == null || row.size === ""
        ? null
        : String(row.size).trim().slice(0, 16) || null
    const supplierPriceEur =
      typeof row.supplierPriceEur === "number" && Number.isFinite(row.supplierPriceEur) && row.supplierPriceEur > 0
        ? Math.round(row.supplierPriceEur * 100) / 100
        : null
    const stock =
      typeof row.stock === "number" && Number.isFinite(row.stock) && row.stock >= 0
        ? Math.floor(row.stock)
        : null
    out.push({
      color,
      size: sizeRaw,
      sku: sanitizeSku(row.sku),
      supplierPriceEur,
      stock,
    })
    if (out.length >= 120) break
  }
  return out
}

export function normalizeSpecsFromAi(
  raw: unknown,
  characteristics: GenerateVariantsCharDef[]
): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const allowed = new Set(characteristics.map((c) => c.key))
  const byKey = new Map(characteristics.map((c): [string, GenerateVariantsCharDef] => [c.key, c]))
  const out: Record<string, string> = {}

  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(k)) continue
    const def = byKey.get(k)
    const str = typeof v === "string" ? v.trim() : String(v ?? "").trim()
    if (!str || !def) continue
    if (def.type === "SELECT" && def.options.length > 0) {
      const match = def.options.find((o) => o.toLowerCase() === str.toLowerCase())
      if (match) out[k] = match
    } else if (def.type === "NUMBER") {
      if (Number.isFinite(Number(str.replace(",", ".")))) out[k] = str.replace(",", ".")
    } else {
      out[k] = str.slice(0, 500)
    }
  }
  return out
}

export function normalizeGenerateVariantsPayload(
  input: GenerateVariantsInput,
  raw: unknown
): GenerateVariantsResult {
  const payload = (raw && typeof raw === "object" ? raw : {}) as AiGeneratePayload
  const colors = normalizeColors(payload)
  const advancedRows = normalizeAdvancedRows(payload)
  const sizesText = normalizeSizesText(payload)
  const specs = normalizeSpecsFromAi(payload.specs, input.characteristics)

  let variantMode: GenerateVariantsResult["variantMode"] = "none"
  const modeHint = typeof payload.variantMode === "string" ? payload.variantMode.trim().toLowerCase() : ""

  if (modeHint === "advanced" || advancedRows.length > 0) {
    variantMode = advancedRows.length > 0 || colors.length > 0 ? "advanced" : "none"
  } else if (modeHint === "simple" || colors.length > 0 || sizesText.length > 0) {
    variantMode = colors.length > 0 || sizesText.length > 0 ? "simple" : "none"
  }

  if (variantMode === "advanced" && advancedRows.length === 0 && colors.length > 0) {
    variantMode = sizesText.length > 0 || colors.length > 1 ? "advanced" : "simple"
  }

  const summary =
    typeof payload.summary === "string" && payload.summary.trim()
      ? payload.summary.trim().slice(0, 400)
      : buildDefaultSummary({ variantMode, colors, sizesText, specs, advancedRows })

  return {
    variantMode,
    sizesText,
    colors,
    specs,
    advancedRows,
    summary,
  }
}

function buildDefaultSummary(args: {
  variantMode: GenerateVariantsResult["variantMode"]
  colors: GeneratedColorRow[]
  sizesText: string
  specs: Record<string, string>
  advancedRows: GeneratedAdvancedRow[]
}): string {
  const parts: string[] = []
  if (args.variantMode === "advanced") {
    parts.push(`${args.advancedRows.length || args.colors.length} ligne(s) SKU`)
  } else if (args.variantMode === "simple") {
    if (args.colors.length) parts.push(`${args.colors.length} couleur(s)`)
    if (args.sizesText) parts.push(`tailles ${args.sizesText}`)
  }
  const specCount = Object.keys(args.specs).length
  if (specCount) parts.push(`${specCount} caractéristique(s)`)
  return parts.join(" · ") || "Aucune modification détectée"
}

export function buildVariantComposerFormPatch(
  result: GenerateVariantsResult,
  ctx: {
    basePriceEur: number
    defaultCommission: number
    skuPrefix?: string
  }
): VariantComposerFormPatch {
  const skuPrefix = ctx.skuPrefix?.trim() || "PRD"
  const basePrice = ctx.basePriceEur > 0 ? ctx.basePriceEur : 10
  const commission = ctx.defaultCommission > 0 ? ctx.defaultCommission : 15

  if (result.variantMode === "none") {
    return {
      variantMode: "none",
      sizesText: "",
      simpleColors: [],
      advancedSkuRows: [],
      specValuesPatch: result.specs,
    }
  }

  if (result.variantMode === "advanced") {
    let rows: SupplierSkuTableRow[] = []

    if (result.advancedRows.length > 0) {
      rows = result.advancedRows.map((row) => ({
        id: newVariantRowId(),
        color: row.color,
        size: row.size,
        sku:
          row.sku ??
          suggestVariantSkuFromRow(skuPrefix, row.color, row.size),
        supplierPrice: row.supplierPriceEur ?? basePrice,
        compareAtEur: null,
        stock: row.stock ?? 0,
        commissionRate: commission,
        customFields: {},
      }))
      rows = fillMissingVariantSkus(rows, skuPrefix).rows
    } else if (result.colors.length > 0) {
      rows = generateSkuTableRowsFromSetup({
        colorRows: result.colors.map((c) => ({
          id: newVariantRowId(),
          name: c.name,
          image: "",
        })),
        sizesText: result.sizesText,
        skuPrefix,
        defaults: {
          supplierPrice: basePrice,
          compareAtEur: null,
          stock: 0,
          commissionRate: commission,
          customFieldValues: {},
        },
        customColumns: [],
      })
    }

    return {
      variantMode: "advanced",
      sizesText: result.sizesText,
      simpleColors: [],
      advancedSkuRows: rows,
      specValuesPatch: result.specs,
    }
  }

  const simpleColors =
    result.colors.length > 0
      ? result.colors.map((c) => ({
          id: newVariantRowId(),
          name: c.name,
          image: "",
        }))
      : [{ id: newVariantRowId(), name: "", image: "" }]

  return {
    variantMode: "simple",
    sizesText: result.sizesText,
    simpleColors,
    advancedSkuRows: [],
    specValuesPatch: result.specs,
  }
}

function buildPrompt(input: GenerateVariantsInput): { system: string; user: string } {
  const charLines = input.characteristics.map((c) => {
    const req = c.required ? "required" : "optional"
    if (c.type === "SELECT" && c.options.length > 0) {
      return `- ${c.key} (${c.label}, ${req}, SELECT): one of ${c.options.join(" | ")}`
    }
    if (c.type === "NUMBER") return `- ${c.key} (${c.label}, ${req}, NUMBER)`
    return `- ${c.key} (${c.label}, ${req}, TEXT)`
  })

  const context = [
    input.title.trim() ? `Titre produit: ${input.title.trim()}` : "",
    input.categoryPath.trim() ? `Catégorie: ${input.categoryPath.trim()}` : "",
    input.description.trim() ? `Description:\n${input.description.trim().slice(0, 900)}` : "",
    input.bullets.length ? `Points clés:\n${input.bullets.map((b) => `- ${b}`).join("\n")}` : "",
    `Prix catalogue fournisseur par défaut: ${input.basePriceEur.toFixed(2)} EUR`,
    `Commission par défaut: ${input.defaultCommission}%`,
  ]
    .filter(Boolean)
    .join("\n\n")

  return {
    system: `Tu es l'assistant catalogue Affisell — expert e-commerce B2B.
Tu transformes des instructions en langage naturel (FR/EN) en données produit structurées.
Réponds UNIQUEMENT en JSON valide, sans markdown.
Règles couleurs: une entrée = une couleur, max 48 car., caractères autorisés lettres/chiffres/espaces - / & ' ( ) . — pas de virgule ni + dans un nom.
Tailles: liste séparée par virgules (ex. "S, M, L, XL" ou "38, 40, 42").
variantMode:
- "simple" si seulement couleurs/tailles sans SKU/stock/prix par ligne
- "advanced" si l'utilisateur demande SKU, stock par variante, prix par variante, ou matrice détaillée
- "none" si la demande ne concerne que les caractéristiques (specs) sans variantes
Ne invente pas de certifications, marques ou specs absentes du prompt ou du contexte produit.`,
    user: `Demande fournisseur:
"""
${input.prompt.trim().slice(0, PROMPT_MAX)}
"""

${context}

Caractéristiques catégorie (clés autorisées pour "specs"):
${charLines.length ? charLines.join("\n") : "(aucune — laisser specs vide ou omettre)"}

JSON attendu:
{
  "variantMode": "simple" | "advanced" | "none",
  "sizesText": "S, M, L",
  "colors": [{ "name": "Noir", "hex": "#000000" }],
  "specs": { "material": "Coton" },
  "advancedRows": [{ "color": "Noir", "size": "M", "sku": null, "supplierPriceEur": 29.9, "stock": 50 }],
  "summary": "Phrase courte en français décrivant ce qui a été créé"
}`,
  }
}

export async function generateSupplierVariantsFromPrompt(
  input: GenerateVariantsInput
): Promise<GenerateVariantsResult> {
  const prompt = input.prompt.trim()
  if (prompt.length < 8) {
    throw new Error("Décrivez votre demande en au moins 8 caractères.")
  }

  const { system, user } = buildPrompt(input)
  const raw = await groqChatText({
    vision: false,
    temperature: 0.2,
    max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  })

  if (!raw?.trim()) throw new Error("L'IA n'a pas renvoyé de texte.")

  const parsed = extractJsonObject(raw)
  const result = normalizeGenerateVariantsPayload(input, parsed)

  console.log("[supplier-generate-variants]", {
    variantMode: result.variantMode,
    colorCount: result.colors.length,
    advancedCount: result.advancedRows.length,
    specCount: Object.keys(result.specs).length,
  })

  const hasVariants =
    result.variantMode !== "none" &&
    (result.colors.length > 0 || result.advancedRows.length > 0 || result.sizesText.length > 0)
  const hasSpecs = Object.keys(result.specs).length > 0

  if (!hasVariants && !hasSpecs) {
    throw new Error(
      "Impossible d'interpréter la demande — précisez couleurs, tailles ou caractéristiques."
    )
  }

  return result
}
