import { GROQ_VISION_MAX_IMAGES } from "@/lib/ai/groq-vision"
import { groqChatText, GROQ_TEXT_MODEL, GROQ_VISION_MODEL } from "@/lib/ai/groq-client"
import { buildVisionImagePayload } from "@/lib/supplier-generate-description"

const MAX_DATA_URL_LEN = 1_400_000

export type GenerateTitleRequest = {
  titleDraft: string
  notes: string
  bullets: string[]
  categoryPath: string
  productImageUrls: string[]
  productImageDataUrls: string[]
}

export type GenerateTitleResult = {
  title: string
  titleVariants: string[]
  subtitle: string
  bulletPoints: string[]
  seoKeywords: string[]
  insight: string
}

function stripJsonFence(s: string): string {
  const t = s.trim()
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }
  return t
}

function isAllowedDataImageUrl(s: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s) && s.length <= MAX_DATA_URL_LEN
}

function normalizeBullets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
}

export async function generateSupplierProductTitle(
  input: GenerateTitleRequest
): Promise<GenerateTitleResult> {
  const titleDraft = input.titleDraft.trim().slice(0, 500)
  const notes = input.notes.trim().slice(0, 4000)
  const bullets = input.bullets.map((s) => s.trim()).filter(Boolean).slice(0, 6)
  const categoryPath = input.categoryPath.trim().slice(0, 500)

  const productImageUrls = input.productImageUrls
    .filter((u) => /^https?:\/\//i.test(u.trim()))
    .map((u) => u.trim())
    .slice(0, 2)
  const productImageDataUrls = input.productImageDataUrls
    .filter((u) => isAllowedDataImageUrl(u.trim()))
    .map((u) => u.trim())
    .slice(0, 2)

  const { visionImages } = buildVisionImagePayload({
    illustrationUrls: [],
    galleryDataUrls: productImageDataUrls,
    galleryUrls: productImageUrls,
  })
  const useVision = visionImages.length > 0

  const schema = `JSON uniquement:
{
  "title": string (titre marketplace principal, 45-110 caractères, bénéfice + produit, pas de CLICKBAIT, français),
  "titleVariants": string[] (2 titres alternatifs, même contraintes),
  "subtitle": string (sous-titre accroche 60-90 caractères, complète le titre),
  "bulletPoints": string[] (4 à 6 puces vente, commencent par un bénéfice concret),
  "seoKeywords": string[] (5 à 8 mots-clés recherche),
  "insight": string (1 phrase : stratégie copy choisie)
}`

  const userText = [
    `Catégorie: ${categoryPath || "(non définie)"}`,
    `Titre brouillon: ${titleDraft || "(vide)"}`,
    `Notes: ${notes || "(aucune)"}`,
    bullets.length > 0 ? `Points:\n${bullets.map((b) => `- ${b}`).join("\n")}` : "",
    useVision
      ? "Analyse les photos pour extraire matériaux, usage, différenciation visible."
      : "",
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

  const raw =
    (await groqChatText({
      model: useVision ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
      vision: useVision,
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es un directeur créatif e-commerce Affisell. Titres optimisés conversion + SEO marketplace. Factuel, premium, jamais de fausses promesses.",
        },
        { role: "user", content: userContent },
      ],
    })) ?? "{}"

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>
  } catch {
    throw new Error("Réponse IA invalide")
  }

  const title =
    typeof parsed.title === "string" ? parsed.title.trim().slice(0, 120) : titleDraft.slice(0, 120)
  if (!title) throw new Error("Titre vide")

  const titleVariants = Array.isArray(parsed.titleVariants)
    ? parsed.titleVariants
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 2)
    : []

  const subtitle = typeof parsed.subtitle === "string" ? parsed.subtitle.trim().slice(0, 100) : ""
  const bulletPoints = normalizeBullets(parsed.bulletPoints)
  const seoKeywords = Array.isArray(parsed.seoKeywords)
    ? parsed.seoKeywords
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8)
    : []
  const insight = typeof parsed.insight === "string" ? parsed.insight.trim().slice(0, 280) : ""

  return {
    title,
    titleVariants,
    subtitle,
    bulletPoints: bulletPoints.length > 0 ? bulletPoints : bullets,
    seoKeywords,
    insight,
  }
}
