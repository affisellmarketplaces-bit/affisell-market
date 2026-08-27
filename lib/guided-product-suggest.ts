import "server-only"

import { groqChatText, getGroqApiKey, GROQ_TEXT_MODEL } from "@/lib/ai/groq-client"
import { hasOpenAiFallback } from "@/lib/ai/openai-chat-fallback"
import {
  EMPTY_GUIDED_AI_SUGGESTION,
  formatGuidedPrice,
  mapTextToGuidedCategory,
  type GuidedCategoryLabel,
  type GuidedProductAiSuggestion,
} from "@/lib/guided-product-ai-shared"
import { prisma } from "@/lib/prisma"
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

async function inferGuidedAttributes(args: {
  title: string
  categoryPath: string
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
    `Catégorie: ${args.categoryPath || "(non définie)"}`,
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
  if (!hasAiKeys && !durableImage && title.length < 3) {
    return { ...EMPTY_GUIDED_AI_SUGGESTION, fallback: true, source: "fallback" }
  }

  let category: GuidedCategoryLabel | null = null
  let categoryConfidence = 0
  let categoryReason: string | null = null
  let categoryPath = ""
  let visionUsed = false
  let listingSource: GuidedProductAiSuggestion["source"] = "none"

  try {
    const listing = await suggestListingCategories(title, "", prisma, {
      imageUrl: durableImage,
      bullets: [],
    })

    visionUsed = Boolean(listing.visionUsed)
    listingSource = listing.source === "none" || listing.source === "empty" ? "none" : listing.source

    const top = listing.suggestions[0]
    if (top?.breadcrumb) {
      categoryPath = top.breadcrumb
      category = mapTextToGuidedCategory(top.breadcrumb)
      categoryConfidence = top.confidence ?? 0
      categoryReason = top.aiReason ?? null
    }

    if (!category && listing.productInsight?.focusLabel) {
      category = mapTextToGuidedCategory(listing.productInsight.focusLabel)
      if (category && categoryConfidence === 0) categoryConfidence = 0.55
    }
  } catch (err) {
    console.log("[guided-product-suggest]", {
      step: "listing",
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
  }

  let recommendedTitle: string | null = null
  let titleVariants: string[] = []
  let subtitle: string | null = null
  let seoKeywords: string[] = []
  let insight: string | null = null
  let bulletPoints: string[] = []

  if (hasAiKeys && (title.length >= 2 || durableImage || imageDataUrl)) {
    try {
      const copy = await generateSupplierProductTitle({
        titleDraft: title || listingSuggestedName(title),
        notes: "",
        bullets: [],
        categoryPath,
        productImageUrls: durableImage ? [durableImage] : [],
        productImageDataUrls: imageDataUrl ? [imageDataUrl] : [],
      })
      recommendedTitle = copy.title || null
      titleVariants = copy.titleVariants
      subtitle = copy.subtitle || null
      seoKeywords = copy.seoKeywords
      insight = copy.insight || null
      bulletPoints = copy.bulletPoints
      if (!visionUsed && (durableImage || imageDataUrl)) visionUsed = true
    } catch (err) {
      console.log("[guided-product-suggest]", {
        step: "generate_title",
        result: "error",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const attributes = await inferGuidedAttributes({
    title: recommendedTitle ?? title,
    categoryPath,
    bulletPoints,
    seoKeywords,
  })

  const hasAnySuggestion =
    Boolean(recommendedTitle) ||
    titleVariants.length > 0 ||
    Boolean(category) ||
    Boolean(attributes.material) ||
    Boolean(attributes.color)

  console.log("[guided-product-suggest]", {
    result: hasAnySuggestion ? "ok" : "empty",
    category,
    categoryConfidence,
    visionUsed,
    titleLen: recommendedTitle?.length ?? title.length,
  })

  return {
    recommendedTitle,
    titleVariants,
    subtitle,
    seoKeywords,
    insight,
    category,
    categoryConfidence,
    categoryReason,
    attributes,
    visionUsed,
    source: hasAnySuggestion
      ? listingSource === "hybrid" || listingSource === "keyword"
        ? "hybrid"
        : "ai"
      : "fallback",
    fallback: !hasAnySuggestion,
  }
}

function listingSuggestedName(title: string): string {
  return title.trim() || "Produit"
}

export { formatGuidedPrice }
