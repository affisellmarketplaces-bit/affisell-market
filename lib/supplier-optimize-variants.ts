import { groqChatText } from "@/lib/ai/groq-client"
import {
  fillMissingVariantSkus,
  suggestVariantSkuFromRow,
  type SupplierSkuTableRow,
  VARIANT_COLOR_REGEX,
} from "@/lib/supplier-sku-builder"
import {
  SIMPLE_COLOR_NAME_MAX,
  validateSimpleColorName,
} from "@/lib/supplier-simple-color-validation"

export type OptimizeVariantsRowInput = {
  index: number
  color: string
  size: string | null
  sku: string | null
}

export type OptimizeVariantsInput = {
  mode: "simple" | "advanced"
  title: string
  description: string
  categoryPath: string
  bullets: string[]
  sizesText?: string
  simpleColors?: Array<{ index: number; name: string }>
  rows?: OptimizeVariantsRowInput[]
  skuPrefix?: string
}

export type OptimizeVariantsResult = {
  sizesText?: string
  simpleColors?: Array<{ index: number; name: string }>
  rows?: Array<{ index: number; color: string; size: string | null; sku: string | null }>
}

type AiVariantsPayload = {
  sizesText?: string
  simpleColors?: Array<{ index?: number; name?: string }>
  rows?: Array<{ index?: number; color?: string; size?: string | null; sku?: string | null }>
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fence?.[1]) {
      return JSON.parse(fence[1].trim()) as unknown
    }
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown
    }
    throw new Error("Réponse IA invalide.")
  }
}

function sanitizeColorLabel(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, SIMPLE_COLOR_NAME_MAX)
}

function sanitizeSku(value: string | null | undefined, maxLen = 64): string | null {
  const t = value?.trim()
  if (!t) return null
  return t.replace(/\s+/g, "-").slice(0, maxLen)
}

export function applyOptimizedSimpleColorNames(
  rows: Array<{ id: string; name: string; image: string }>,
  optimized: Array<{ index: number; name: string }>
): Array<{ id: string; name: string; image: string }> {
  if (optimized.length === 0) return rows
  const byIndex = new Map(optimized.map((row) => [row.index, row.name]))
  return rows.map((row, index) => {
    const nextName = byIndex.get(index)
    if (!nextName?.trim()) return row
    const sanitized = sanitizeColorLabel(nextName)
    if (validateSimpleColorName(sanitized)) return row
    return { ...row, name: sanitized }
  })
}

export function applyOptimizedSkuRows(
  rows: SupplierSkuTableRow[],
  optimized: Array<{ index: number; color: string; size: string | null; sku: string | null }>,
  skuPrefix: string
): SupplierSkuTableRow[] {
  if (optimized.length === 0) return rows
  const byIndex = new Map(optimized.map((row) => [row.index, row]))

  const merged = rows.map((row, index) => {
    const patch = byIndex.get(index)
    if (!patch) return row

    const color = sanitizeColorLabel(patch.color || row.color)
    const safeColor = color && VARIANT_COLOR_REGEX.test(color) ? color : row.color.trim()
    const sizeRaw = patch.size?.trim() ?? row.size?.trim() ?? ""
    const size = sizeRaw.length > 0 ? sizeRaw.slice(0, 16) : null
    const skuFromAi = sanitizeSku(patch.sku)
    const sku =
      skuFromAi && skuFromAi.length > 0
        ? skuFromAi
        : safeColor
          ? suggestVariantSkuFromRow(skuPrefix, safeColor, size)
          : row.sku

    return {
      ...row,
      color: safeColor || row.color,
      size,
      sku,
    }
  })

  return fillMissingVariantSkus(merged, skuPrefix).rows
}

function normalizeAiPayload(
  input: OptimizeVariantsInput,
  raw: unknown
): OptimizeVariantsResult {
  const payload = (raw && typeof raw === "object" ? raw : {}) as AiVariantsPayload
  const result: OptimizeVariantsResult = {}

  if (typeof payload.sizesText === "string" && payload.sizesText.trim()) {
    result.sizesText = payload.sizesText.trim().slice(0, 200)
  }

  if (input.mode === "simple" && Array.isArray(payload.simpleColors)) {
    result.simpleColors = payload.simpleColors
      .map((row) => ({
        index: typeof row.index === "number" ? Math.floor(row.index) : -1,
        name: typeof row.name === "string" ? sanitizeColorLabel(row.name) : "",
      }))
      .filter((row) => row.index >= 0 && row.name.length > 0 && !validateSimpleColorName(row.name))
  }

  if (input.mode === "advanced" && Array.isArray(payload.rows)) {
    result.rows = payload.rows
      .map((row) => ({
        index: typeof row.index === "number" ? Math.floor(row.index) : -1,
        color: typeof row.color === "string" ? sanitizeColorLabel(row.color) : "",
        size:
          row.size == null || row.size === ""
            ? null
            : String(row.size).trim().slice(0, 16) || null,
        sku: sanitizeSku(typeof row.sku === "string" ? row.sku : null),
      }))
      .filter((row) => row.index >= 0 && row.color.length > 0 && VARIANT_COLOR_REGEX.test(row.color))
  }

  return result
}

function buildPrompt(input: OptimizeVariantsInput): { system: string; user: string } {
  const bullets = input.bullets.map((b) => b.trim()).filter(Boolean)
  const context = [
    input.title.trim() ? `Titre: ${input.title.trim()}` : "",
    input.categoryPath.trim() ? `Catégorie: ${input.categoryPath.trim()}` : "",
    input.description.trim() ? `Description:\n${input.description.trim().slice(0, 1200)}` : "",
    bullets.length ? `Points clés:\n${bullets.map((b) => `- ${b}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  if (input.mode === "simple") {
    const colors = (input.simpleColors ?? [])
      .map((c) => `${c.index}: ${c.name.trim() || "(vide)"}`)
      .join("\n")
    return {
      system:
        "Tu es expert catalogue e-commerce Affisell. Tu normalises les noms de variantes pour la marketplace. Réponds UNIQUEMENT en JSON valide, sans markdown.",
      user: `Optimise les couleurs et tailles du produit (mode simple).
Règles couleurs: une couleur par ligne, max 48 caractères, caractères autorisés lettres/chiffres/espaces - / & ' ( ) .
Pas de virgule ni + dans un nom de couleur. Style clair type Amazon/AliExpress (ex. "X1 (7.8Ah 25KM)", "ES80 (10.5Ah)").
Ne change pas le nombre de lignes. Ne invente pas de specs absentes du contexte.

Tailles actuelles: ${input.sizesText?.trim() || "(aucune)"}
Couleurs actuelles (index: nom):
${colors || "(aucune)"}

${context}

JSON attendu:
{
  "sizesText": "S, M, L",
  "simpleColors": [{ "index": 0, "name": "..." }]
}`,
    }
  }

  const rows = (input.rows ?? [])
    .map((r) => `${r.index}: couleur="${r.color}" taille="${r.size ?? ""}" sku="${r.sku ?? ""}"`)
    .join("\n")

  return {
    system:
      "Tu es expert catalogue e-commerce Affisell. Tu normalises couleurs, tailles et SKU pour un tableau variantes. Réponds UNIQUEMENT en JSON valide, sans markdown.",
    user: `Optimise les lignes SKU (mode tableau).
Règles:
- Couleur: lisible, max 48 car., caractères autorisés lettres/chiffres/espaces - / & ' ( ) .
- Taille: standardiser si pertinent (vide si N/A).
- SKU: format court MAJUSCULES avec préfixe ${input.skuPrefix ?? "PRD"} (ex. PRD-M365-X1-78AH).
- Conserver le même nombre de lignes et les mêmes index.
- Ne pas inventer de specs absentes du contexte.

Lignes actuelles:
${rows || "(aucune)"}

${context}

JSON attendu:
{
  "rows": [{ "index": 0, "color": "...", "size": null, "sku": "PRD-..." }]
}`,
  }
}

export async function optimizeSupplierVariants(input: OptimizeVariantsInput): Promise<OptimizeVariantsResult> {
  const { system, user } = buildPrompt(input)

  const raw = await groqChatText({
    vision: false,
    temperature: 0.25,
    max_tokens: 900,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  })

  if (!raw?.trim()) {
    throw new Error("L'IA n'a pas renvoyé de texte.")
  }

  const parsed = extractJsonObject(raw)
  const result = normalizeAiPayload(input, parsed)

  console.log("[supplier-optimize-variants]", {
    mode: input.mode,
    rowCount: input.rows?.length ?? input.simpleColors?.length ?? 0,
    optimizedRows: result.rows?.length ?? result.simpleColors?.length ?? 0,
  })

  if (
    (input.mode === "simple" && (!result.simpleColors || result.simpleColors.length === 0)) ||
    (input.mode === "advanced" && (!result.rows || result.rows.length === 0))
  ) {
    throw new Error("Aucune variante optimisée — vérifiez les noms de couleur.")
  }

  return result
}
