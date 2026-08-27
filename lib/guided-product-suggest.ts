import "server-only"

import { groqChatText, getGroqApiKey, GROQ_TEXT_MODEL, GROQ_VISION_MODEL } from "@/lib/ai/groq-client"
import { GROQ_VISION_MAX_IMAGES } from "@/lib/ai/groq-vision"
import { hasOpenAiFallback } from "@/lib/ai/openai-chat-fallback"
import {
  GUIDED_CATEGORY_LABELS,
  EMPTY_GUIDED_AI_SUGGESTION,
  mergeGuidedCategoryScores,
  pickGuidedCategoryFromScores,
  resolveGuidedOutputSource,
  scoreGuidedCategoriesFromText,
  mapTextToGuidedCategory,
  type GuidedCategoryLabel,
  type GuidedCategoryScore,
  type GuidedProductAiSuggestion,
  type ListingSuggestSource,
} from "@/lib/guided-product-ai-shared"
import { prisma } from "@/lib/prisma"
import { buildVisionImagePayload } from "@/lib/supplier-generate-description"
import { isDurableListingImageUrl } from "@/lib/supplier-auto-category-policy"
import { generateSupplierProductTitle } from "@/lib/supplier-generate-title"
import { suggestListingCategories } from "@/lib/supplier-suggest-listing"

export type GuidedSuggestInput = {
  title: string
  imageUrl?: string
  imageDataUrl?: string
}

function stripJsonFence(s: string): string {
  const t = s.trim()
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }
  return t
}

function normalizeDirectCategory(raw: unknown): GuidedCategoryLabel | null {
  if (typeof raw !== "string") return null
  const t = raw.trim()
  return GUIDED_CATEGORY_LABELS.find((l) => l.toLowerCase() === t.toLowerCase()) ?? null
}

function parseDirectCategoryScores(parsed: Record<string, unknown>): GuidedCategoryScore[] {
  if (!Array.isArray(parsed.scores)) return []
  const out: GuidedCategoryScore[] = []
  for (const row of parsed.scores) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const label = normalizeDirectCategory(o.label)
    const confidence =
      typeof o.confidence === "number" && Number.isFinite(o.confidence)
        ? Math.min(0.98, Math.max(0, o.confidence))
        : 0
    const reason = typeof o.reason === "string" ? o.reason.trim() : undefined
    if (label && confidence > 0) out.push({ label, confidence, reason })
  }
  return out
}

/** Vision/text classifier locked to the 4 wizard buckets — never returns off-list labels. */
async function classifyGuidedCategoryDirect(input: {
  title: string
  imageUrl?: string
  imageDataUrl?: string
}): Promise<{ scores: GuidedCategoryScore[]; reason: string | null } | null> {
  if (!getGroqApiKey()) return null

  const { visionImages } = buildVisionImagePayload({
    illustrationUrls: [],
    galleryDataUrls: input.imageDataUrl ? [input.imageDataUrl] : [],
    galleryUrls: input.imageUrl ? [input.imageUrl] : [],
  })
  const useVision = visionImages.length > 0

  const schema = `JSON uniquement:
{
  "category": "Fashion" | "Home" | "Beauty" | "Food",
  "confidence": number (0-1),
  "reason": string (1 phrase FR),
  "scores": [
    { "label": "Fashion" | "Home" | "Beauty" | "Food", "confidence": number, "reason": string }
  ]
}

Règles:
- Fashion = mode, vêtements, chaussures, sacs, bijoux, montres fashion
- Home = maison, déco, cuisine, électroménager, high-tech, jardin, bricolage
- Beauty = cosmétiques, soins, maquillage, parfums, hygiène
- Food = alimentation, boissons, épicerie
- scores doit contenir les 4 labels exacts, confidences somme ≈ 1`

  const userText = [
    `Titre fournisseur: ${input.title.trim() || "(vide — la photo prime)"}`,
    useVision ? "Analyse la photo produit pour classer dans UNE des 4 catégories wizard." : "",
    schema,
  ]
    .filter(Boolean)
    .join("\n\n")

  const userContent = useVision
    ? [
        { type: "text" as const, text: userText },
        ...visionImages.slice(0, GROQ_VISION_MAX_IMAGES).map((url) => ({
          type: "image_url" as const,
          image_url: { url },
        })),
      ]
    : userText

  try {
    const raw =
      (await groqChatText({
        model: useVision ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
        vision: useVision,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Tu es le classifieur Affisell Wizard. Tu ne peux répondre qu'avec Fashion, Home, Beauty ou Food — jamais d'autre catégorie.",
          },
          { role: "user", content: userContent },
        ],
      })) ?? "{}"

    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>
    const directLabel = normalizeDirectCategory(parsed.category)
    const directConf =
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.min(0.98, Math.max(0, parsed.confidence))
        : 0
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : null

    let scores = parseDirectCategoryScores(parsed)
    if (directLabel && directConf > 0) {
      scores = mergeGuidedCategoryScores(scores, [{ label: directLabel, confidence: directConf, reason: reason ?? undefined }])
    }

    if (scores.length === 0 && directLabel) {
      scores = [{ label: directLabel, confidence: directConf || 0.72, reason: reason ?? undefined }]
    }

    return scores.length > 0 ? { scores, reason } : null
  } catch (err) {
    console.log("[guided-product-suggest]", {
      step: "classify_direct",
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

async function inferGuidedAttributes(args: {
  title: string
  categoryLabel: GuidedCategoryLabel | null
  bulletPoints: string[]
  seoKeywords: string[]
}): Promise<GuidedProductAiSuggestion["attributes"]> {
  if (!getGroqApiKey()) {
    return EMPTY_GUIDED_AI_SUGGESTION.attributes
  }

  const schema = `JSON uniquement:
{
  "material": string (matériau principal, ex. "Coton bio"),
  "color": string (couleur dominante, ex. "Noir"),
  "dimensions": string (ex. "30 × 20 × 5 cm" ou "Taille M" si pertinent),
  "suggestedPrice": number (prix EUR réaliste marketplace, ex. 29.99)
}`

  const userText = [
    `Produit: ${args.title}`,
    `Catégorie wizard: ${args.categoryLabel ?? "(non définie)"}`,
    args.bulletPoints.length > 0 ? `Points:\n${args.bulletPoints.map((b) => `- ${b}`).join("\n")}` : "",
    args.seoKeywords.length > 0 ? `Mots-clés: ${args.seoKeywords.join(", ")}` : "",
    schema,
  ]
    .filter(Boolean)
    .join("\n\n")

  try {
    const raw =
      (await groqChatText({
        model: GROQ_TEXT_MODEL,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Tu es expert fiche produit e-commerce EU. Réponds factuellement en français. Prix réaliste TTC.",
          },
          { role: "user", content: userText },
        ],
      })) ?? "{}"

    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>
    const material = typeof parsed.material === "string" ? parsed.material.trim() : ""
    const color = typeof parsed.color === "string" ? parsed.color.trim() : ""
    const dimensions = typeof parsed.dimensions === "string" ? parsed.dimensions.trim() : ""
    const suggestedPrice =
      typeof parsed.suggestedPrice === "number" && Number.isFinite(parsed.suggestedPrice)
        ? parsed.suggestedPrice
        : Number.isFinite(Number(parsed.suggestedPrice))
          ? Number(parsed.suggestedPrice)
          : null

    return {
      material: material || null,
      color: color || null,
      dimensions: dimensions || null,
      suggestedPrice: suggestedPrice != null && suggestedPrice > 0 ? suggestedPrice : null,
    }
  } catch (err) {
    console.log("[guided-product-suggest]", {
      step: "infer_attributes",
      result: "fallback",
      message: err instanceof Error ? err.message : String(err),
    })
    return EMPTY_GUIDED_AI_SUGGESTION.attributes
  }
}

/** Vision + taxonomy + copy — unified suggestions for the 4-step guided wizard. */
export async function suggestGuidedProduct(input: GuidedSuggestInput): Promise<GuidedProductAiSuggestion> {
  const title = input.title.trim()
  const durableImage = isDurableListingImageUrl(input.imageUrl) ? input.imageUrl!.trim() : undefined
  const imageDataUrl =
    typeof input.imageDataUrl === "string" && input.imageDataUrl.startsWith("data:image/")
      ? input.imageDataUrl.trim()
      : undefined

  const hasAiKeys = Boolean(getGroqApiKey() || hasOpenAiFallback())
  const hasImageSignal = Boolean(durableImage || imageDataUrl)
  if (!hasAiKeys && !hasImageSignal && title.length < 3) {
    return { ...EMPTY_GUIDED_AI_SUGGESTION, fallback: true, source: "fallback" }
  }

  let categoryPath = ""
  let visionUsed = false
  let listingSource: ListingSuggestSource = "none"
  const taxonomyScores: GuidedCategoryScore[] = []

  try {
    const listing = await suggestListingCategories(title, "", prisma, {
      imageUrl: durableImage,
      bullets: [],
    })

    visionUsed = Boolean(listing.visionUsed)
    listingSource = listing.source

    const top = listing.suggestions[0]
    if (top?.breadcrumb) {
      categoryPath = top.breadcrumb
      const mapped = mapTextToGuidedCategory(top.breadcrumb)
      if (mapped) {
        taxonomyScores.push({
          label: mapped,
          confidence: Math.min(0.88, top.confidence ?? 0.55),
          reason: top.aiReason ?? "Taxonomie Affisell",
        })
      }
    }

    if (listing.productInsight?.focusLabel) {
      const mapped = mapTextToGuidedCategory(listing.productInsight.focusLabel)
      if (mapped) {
        taxonomyScores.push({
          label: mapped,
          confidence: 0.52,
          reason: "Signal produit",
        })
      }
    }

    if (listing.suggestedProductName) {
      const mapped = mapTextToGuidedCategory(listing.suggestedProductName)
      if (mapped) {
        taxonomyScores.push({ label: mapped, confidence: 0.48, reason: "Nom produit vision" })
      }
    }
  } catch (err) {
    console.log("[guided-product-suggest]", {
      step: "listing",
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
  }

  const directResult = hasAiKeys
    ? await classifyGuidedCategoryDirect({
        title,
        imageUrl: durableImage,
        imageDataUrl,
      })
    : null

  if (directResult && hasImageSignal) visionUsed = true

  const textScores = scoreGuidedCategoriesFromText(
    [title, categoryPath, directResult?.reason ?? ""].filter(Boolean).join(" ")
  )

  const categoryScores = mergeGuidedCategoryScores(
    directResult?.scores ?? [],
    taxonomyScores,
    textScores
  )

  const picked = pickGuidedCategoryFromScores(categoryScores, {
    minConfidence: hasImageSignal ? 0.3 : 0.34,
  })

  let recommendedTitle: string | null = null
  let titleVariants: string[] = []
  let subtitle: string | null = null
  let seoKeywords: string[] = []
  let insight: string | null = null
  let bulletPoints: string[] = []

  if (hasAiKeys && (title.length >= 2 || hasImageSignal)) {
    try {
      const copy = await generateSupplierProductTitle({
        titleDraft: title || "Produit",
        notes: "",
        bullets: [],
        categoryPath: picked?.category ?? categoryPath,
        productImageUrls: durableImage ? [durableImage] : [],
        productImageDataUrls: imageDataUrl ? [imageDataUrl] : [],
      })
      recommendedTitle = copy.title || null
      titleVariants = copy.titleVariants
      subtitle = copy.subtitle || null
      seoKeywords = copy.seoKeywords
      insight = copy.insight || null
      bulletPoints = copy.bulletPoints
      if (!visionUsed && hasImageSignal) visionUsed = true

      if (recommendedTitle) {
        const titleCategoryScores = scoreGuidedCategoriesFromText(recommendedTitle)
        for (const row of mergeGuidedCategoryScores(categoryScores, titleCategoryScores)) {
          const idx = categoryScores.findIndex((s) => s.label === row.label)
          if (idx >= 0) categoryScores[idx] = row
          else categoryScores.push(row)
        }
        categoryScores.sort((a, b) => b.confidence - a.confidence)
      }
    } catch (err) {
      console.log("[guided-product-suggest]", {
        step: "generate_title",
        result: "error",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const finalPick =
    pickGuidedCategoryFromScores(categoryScores, {
      minConfidence: hasImageSignal ? 0.28 : 0.34,
    }) ?? picked

  const attributes = await inferGuidedAttributes({
    title: recommendedTitle ?? title,
    categoryLabel: finalPick?.category ?? null,
    bulletPoints,
    seoKeywords,
  })

  const hasAnySuggestion =
    Boolean(recommendedTitle) ||
    titleVariants.length > 0 ||
    Boolean(finalPick?.category) ||
    categoryScores.some((s) => s.confidence > 0) ||
    Boolean(attributes.material) ||
    Boolean(attributes.color)

  console.log("[guided-product-suggest]", {
    result: hasAnySuggestion ? "ok" : "empty",
    category: finalPick?.category ?? null,
    categoryConfidence: finalPick?.confidence ?? 0,
    visionUsed,
    titleLen: recommendedTitle?.length ?? title.length,
  })

  return {
    recommendedTitle,
    titleVariants,
    subtitle,
    seoKeywords,
    insight,
    category: finalPick?.category ?? null,
    categoryConfidence: finalPick?.confidence ?? 0,
    categoryReason: finalPick?.reason ?? directResult?.reason ?? null,
    categoryScores,
    attributes,
    visionUsed,
    source: resolveGuidedOutputSource(listingSource, hasAnySuggestion),
    fallback: !hasAnySuggestion,
  }
}

export { formatGuidedPrice } from "@/lib/guided-product-ai-shared"
