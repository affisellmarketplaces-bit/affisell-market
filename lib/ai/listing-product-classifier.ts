import { groqChatText, GROQ_TEXT_MODEL, GROQ_VISION_MODEL } from "@/lib/ai/groq-client"
import { matchCategoryToLeafId, type ClassifySuggestionRow } from "@/lib/ai/classify-product"
import type { LeafPath } from "@/lib/category-browse"
import {
  breadcrumbConflictsWithIdentity,
  formatListingContextForAi,
  type ListingProductContext,
} from "@/lib/listing-product-signal"

export type ListingProductIdentity = {
  productNameFr: string
  productKind: string
  domain: string
  mustNotCategories: string[]
  confidence: number
}

type AiListingPayload = {
  identity?: {
    productNameFr?: string
    productKind?: string
    domain?: string
    mustNotCategories?: string[]
    confidence?: number
  }
  suggestions?: Array<{
    category?: string
    confidence?: number
    reason?: string
  }>
}

function parseListingPayload(raw: string): AiListingPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    return parsed as AiListingPayload
  } catch {
    return null
  }
}

function normalizeIdentity(
  payload: AiListingPayload,
  ctx: ListingProductContext
): ListingProductIdentity {
  const id = payload.identity ?? {}
  const productNameFr =
    (typeof id.productNameFr === "string" && id.productNameFr.trim()) ||
    ctx.productName ||
    ctx.title
  const productKind = typeof id.productKind === "string" ? id.productKind.trim() : ""
  const domain = typeof id.domain === "string" ? id.domain.trim() : ""
  const mustNotCategories = Array.isArray(id.mustNotCategories)
    ? id.mustNotCategories
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 8)
    : []
  const confidence =
    typeof id.confidence === "number" && Number.isFinite(id.confidence)
      ? Math.min(1, Math.max(0, id.confidence))
      : ctx.nameConfidence

  return {
    productNameFr,
    productKind,
    domain,
    mustNotCategories,
    confidence,
  }
}

/**
 * Title-first listing classifier: one Groq call returns product identity + taxonomy picks.
 */
export async function classifyListingProductForCategories(
  ctx: ListingProductContext,
  options: {
    allowedBreadcrumbs: string[]
    leafPaths: LeafPath[]
    imageUrl?: string | null
  }
): Promise<{
  identity: ListingProductIdentity | null
  suggestions: ClassifySuggestionRow[]
}> {
  if (!process.env.GROQ_API_KEY?.trim() || options.allowedBreadcrumbs.length === 0) {
    return { identity: null, suggestions: [] }
  }

  const listBlock = options.allowedBreadcrumbs.join("\n")
  const contextBlock = formatListingContextForAi(ctx)
  const imageUrl = options.imageUrl?.trim()
  const visionFirst = Boolean(imageUrl)

  const systemHead = visionFirst
    ? `Tu es le moteur de catégorisation Affisell (mode vision + titre).

Étape A — Analyse la PHOTO du produit : forme, usage, matériau, catégorie e-commerce évidente.
Étape B — Croise avec le TITRE fournisseur (s'il est court ou absent, la photo prime).
Étape C — Choisis 1 à 3 catégories UNIQUEMENT dans la liste (copie exacte du libellé).
`
    : `Tu es le moteur de catégorisation Affisell pour fournisseurs.

Étape A — Identifie le PRODUIT VENDU à partir du TITRE (priorité absolue).
Étape B — Choisis 1 à 3 catégories compatibles UNIQUEMENT dans la liste (copie exacte du libellé).
`

  const systemTail = `

Réponds en JSON valide:
{
  "identity": {
    "productNameFr": string,
    "productKind": string,
    "domain": string,
    "mustNotCategories": string[],
    "confidence": number
  },
  "suggestions": [
    { "category": string, "confidence": number, "reason": string }
  ]
}

Règles identity:
- productNameFr = nom court du produit (photo + titre), sans marque marketing.
- mustNotCategories = rayons INTERDITS si le titre parle clairement d'autre chose.
  Ex. moustiquaire → exclure colles, adhésifs, aquarium, artisanat.
  Ex. ventilateur → exclure vélo, lampes sécurité.
- confidence 0–1 sur la compréhension du nom produit.

Règles suggestions:
- "category" = copie exacte d'une ligne de la liste.
- reason cite le type de produit identifié (photo ou titre), jamais un accessoire seul (adhésif, lampe…).
- NE JAMAIS classer d'après une description marketing longue — elle est absente ou filtrée volontairement.
- Moustiquaires / rideaux anti-insectes → Maison et jardin > Habillages de fenêtre > Moustiquaires pour fenêtre
  OU Équipements sportifs > Camping > Moustiquaires. JAMAIS colles, adhésifs, aquarium.
- Ventilateurs portables → Chauffage et climatisation > Ventilateurs.
- Montres/bracelets connectés → moniteurs d'activité, jamais bijoux montres classiques.

LISTE AUTORISÉE:
${listBlock}`

  const system = systemHead + systemTail

  const userText = visionFirst
    ? `${contextBlock}\n\nConsigne: si le titre est vide ou générique, déduis le produit uniquement depuis l'image.`
    : contextBlock
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
        temperature: 0.08,
        response_format: { type: "json_object" },
        max_tokens: 1100,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      })) ?? "{}"

    const payload = parseListingPayload(raw)
    if (!payload) return { identity: null, suggestions: [] }

    const identity = normalizeIdentity(payload, ctx)
    const excludes = identity.mustNotCategories
    const suggestions: ClassifySuggestionRow[] = []
    const rows = Array.isArray(payload.suggestions) ? payload.suggestions : []

    for (const row of rows.slice(0, 3)) {
      const category = typeof row.category === "string" ? row.category.trim() : ""
      const confidence =
        typeof row.confidence === "number" ? row.confidence : Number(row.confidence)
      const reason = typeof row.reason === "string" ? row.reason.trim() : ""
      if (!category || !Number.isFinite(confidence)) continue

      const exact = options.leafPaths.find(
        (lp) => lp.breadcrumb.toLowerCase() === category.toLowerCase()
      )
      const leaf = exact ?? (() => {
        const fuzzy = matchCategoryToLeafId(category, options.leafPaths)
        return fuzzy.leafId
          ? options.leafPaths.find((p) => p.leafId === fuzzy.leafId)
          : null
      })()

      if (!leaf) continue
      if (breadcrumbConflictsWithIdentity(ctx, leaf.breadcrumb, excludes)) continue

      suggestions.push({
        category: leaf.breadcrumb,
        confidence: Math.min(1, Math.max(0, confidence)),
        reason: reason || `Aligné sur « ${identity.productNameFr} »`,
        leafId: leaf.leafId,
      })
    }

    return { identity, suggestions }
  } catch {
    return { identity: null, suggestions: [] }
  }
}
