import { groqChatText, GROQ_TEXT_MODEL, GROQ_VISION_MODEL } from "@/lib/ai/groq-client"
import { scoreTitleAgainstBreadcrumb } from "@/lib/category-browse"
import type { LeafPath } from "@/lib/category-browse"

export type ClassifyInput = {
  title: string
  description: string
  imageUrl?: string | null
}

export type ClassifySuggestionRow = {
  category: string
  confidence: number
  reason: string
  leafId: string | null
}

function normalizeLabel(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}

export function matchCategoryToLeafId(
  rawCategory: string,
  leafPaths: LeafPath[]
): { leafId: string | null; matchedBreadcrumb: string | null } {
  const t = rawCategory.trim()
  if (!t) return { leafId: null, matchedBreadcrumb: null }
  const norm = normalizeLabel(t)
  for (const lp of leafPaths) {
    if (normalizeLabel(lp.breadcrumb) === norm) {
      return { leafId: lp.leafId, matchedBreadcrumb: lp.breadcrumb }
    }
  }
  let best: LeafPath | null = null
  let bestScore = 0
  for (const lp of leafPaths) {
    const s = scoreTitleAgainstBreadcrumb(norm, lp.breadcrumb.toLowerCase())
    if (s > bestScore) {
      bestScore = s
      best = lp
    }
  }
  if (best && bestScore >= 4) {
    return { leafId: best.leafId, matchedBreadcrumb: best.breadcrumb }
  }
  return { leafId: null, matchedBreadcrumb: null }
}

function parseSuggestionsPayload(raw: string): Array<{ category: string; confidence: number; reason: string }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== "object") return []
  const o = parsed as Record<string, unknown>

  if (Array.isArray(o.suggestions)) {
    return o.suggestions
      .map((row) => {
        if (!row || typeof row !== "object") return null
        const r = row as Record<string, unknown>
        const category = typeof r.category === "string" ? r.category.trim() : ""
        const confidence = typeof r.confidence === "number" ? r.confidence : Number(r.confidence)
        const reason = typeof r.reason === "string" ? r.reason.trim() : ""
        if (!category || !Number.isFinite(confidence)) return null
        return { category, confidence, reason }
      })
      .filter((x): x is { category: string; confidence: number; reason: string } => x != null)
  }

  const category = typeof o.category === "string" ? o.category.trim() : ""
  const confidence = typeof o.confidence === "number" ? o.confidence : Number(o.confidence)
  const reason = typeof o.reason === "string" ? o.reason.trim() : ""
  if (!category || !Number.isFinite(confidence)) return []
  return [{ category, confidence, reason }]
}

export async function classifyAffisellProduct(
  input: ClassifyInput,
  ctx: { allowedBreadcrumbs: string[]; leafPaths: LeafPath[] }
): Promise<{ suggestions: ClassifySuggestionRow[]; error?: string }> {
  if (!process.env.GROQ_API_KEY?.trim()) {
    return { suggestions: [] }
  }
  if (ctx.allowedBreadcrumbs.length === 0) {
    return { suggestions: [], error: "No categories available" }
  }

  const listBlock = ctx.allowedBreadcrumbs.join("\n")
  const system = `Tu es un expert e-commerce pour la marketplace Affisell. Classe ce produit dans au plus 3 catégories parmi la liste EXACTE ci-dessous (une ligne = un libellé complet "Département > Sous-catégorie").

Réponds uniquement en JSON valide:
{"suggestions":[{"category": string, "confidence": number, "reason": string}]}

Règles:
- Utilise UNIQUEMENT des chaînes "category" identiques à une ligne de la liste (copie exacte).
- 1 à 3 suggestions, meilleure confiance en premier.
- confidence entre 0 et 1.
- Montres/bracelets connectés, smart bands, trackers d'activité → catégories "Moniteurs d'activité" / moniteurs biométriques, jamais connecteurs électroniques ni générateurs de bruit blanc.
- Dashcam / caméra de voiture / enregistreur multi-canaux → électronique véhicule ou caméras de recul / caméras vidéo, jamais animaux, grilles pour animaux, guides auto, abris de jardin.
- Ne pas classer sur le seul mot "voiture" : identifier d'abord le type de produit (caméra, audio, accessoire, etc.).
- Ventilateurs portables / brumisateurs → Chauffage et climatisation > Ventilateurs. Ignorer lumière/power bank comme catégorie principale. Jamais vélo, sport, lampes sécurité, surveillance.
- Identifier le NOM PRINCIPAL du produit (ventilateur, commode, casque, etc.) avant les adjectifs marketing.
- CarPlay / Android Auto → électronique véhicule, jamais cartes SIM prépayées.
- Commodes / meubles → mobilier/rangement, jamais sport ni électronique.

LISTE AUTORISÉE:
${listBlock}`

  const userText = `TITLE: ${input.title}\nDESCRIPTION: ${input.description.trim() || "(none)"}`
  const imageUrl = input.imageUrl?.trim()

  const userContent = imageUrl
    ? [
        { type: "text" as const, text: userText },
        { type: "image_url" as const, image_url: { url: imageUrl } },
      ]
    : userText

  try {
    const raw =
      (await groqChatText({
        model: imageUrl ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
        vision: Boolean(imageUrl),
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_tokens: 900,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      })) ?? "{}"

    const rows = parseSuggestionsPayload(raw)

    const suggestions: ClassifySuggestionRow[] = []
    for (const row of rows.slice(0, 3)) {
      const exact = ctx.leafPaths.find((lp) => normalizeLabel(lp.breadcrumb) === normalizeLabel(row.category))
      if (exact) {
        suggestions.push({
          category: exact.breadcrumb,
          confidence: Math.min(1, Math.max(0, row.confidence)),
          reason: row.reason,
          leafId: exact.leafId,
        })
        continue
      }
      const fuzzy = matchCategoryToLeafId(row.category, ctx.leafPaths)
      if (fuzzy.leafId && fuzzy.matchedBreadcrumb) {
        suggestions.push({
          category: fuzzy.matchedBreadcrumb,
          confidence: Math.min(1, Math.max(0, row.confidence)),
          reason: row.reason,
          leafId: fuzzy.leafId,
        })
      }
    }

    return { suggestions }
  } catch {
    return { suggestions: [] }
  }
}
