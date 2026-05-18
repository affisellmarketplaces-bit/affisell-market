import { GROQ_VISION_MAX_IMAGES } from "@/lib/ai/groq-vision"
import { groqChatText, GROQ_VISION_MODEL } from "@/lib/ai/groq-client"
import { generateImageWithHf } from "@/lib/ai/hf-image"

const MAX_DATA_URL_LEN = 1_400_000
const MAX_ILLUSTRATIONS = 4
/** Max illustration images sent to vision (rest stay on listing as user uploads) */
const MAX_VISION_ILLUSTRATIONS = 3

export type GenerateDescriptionRequest = {
  title: string
  notes: string
  bullets: string[]
  categoryPath: string
  productImageUrls: string[]
  productImageDataUrls: string[]
  illustrationDataUrls: string[]
  /** Try Hugging Face lifestyle shot when no illustrations and gallery exists */
  generateMissingIllustrations?: boolean
}

export type GenerateDescriptionResult = {
  description: string
  bulletPoints: string[]
  illustrationImages: string[]
  illustrationSource: "kept_user" | "from_gallery" | "generated_hf" | "none"
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

/** Vision payload: illustrations first, then gallery — never exceeds Groq limit. */
export function buildVisionImagePayload(input: {
  illustrationUrls: string[]
  galleryDataUrls: string[]
  galleryUrls: string[]
}): { visionImages: string[]; galleryPool: string[] } {
  const galleryPool = [...input.galleryDataUrls, ...input.galleryUrls]
  const visionImages: string[] = []
  const seen = new Set<string>()
  const add = (u: string) => {
    const s = u.trim()
    if (!s || seen.has(s) || visionImages.length >= GROQ_VISION_MAX_IMAGES) return
    seen.add(s)
    visionImages.push(s)
  }
  for (const u of input.illustrationUrls.slice(0, MAX_VISION_ILLUSTRATIONS)) add(u)
  for (const u of galleryPool) add(u)
  return { visionImages, galleryPool }
}

export function pickGalleryIllustrations(
  urls: string[],
  dataUrls: string[],
  indices: number[]
): string[] {
  const pool = [...dataUrls, ...urls]
  const out: string[] = []
  const seen = new Set<string>()
  for (const i of indices) {
    if (!Number.isInteger(i) || i < 0 || i >= pool.length) continue
    const u = pool[i]!
    if (seen.has(u)) continue
    seen.add(u)
    out.push(u)
    if (out.length >= MAX_ILLUSTRATIONS) break
  }
  return out
}

async function generateLifestyleDataUrl(prompt: string): Promise<string | null> {
  const buf = await generateImageWithHf(
    `Professional e-commerce lifestyle product photo, soft natural light, clean background: ${prompt}`.slice(
      0,
      1800
    )
  )
  if (!buf) return null
  return `data:image/jpeg;base64,${buf.toString("base64")}`
}

export async function generateSupplierProductDescription(
  input: GenerateDescriptionRequest
): Promise<GenerateDescriptionResult> {
  const title = input.title.trim().slice(0, 500)
  const notes = input.notes.trim().slice(0, 8000)
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

  const userIllustrations = input.illustrationDataUrls
    .filter((u) => isAllowedDataImageUrl(u.trim()) || /^https?:\/\//i.test(u.trim()))
    .map((u) => u.trim())
    .slice(0, MAX_ILLUSTRATIONS)

  const { visionImages, galleryPool } = buildVisionImagePayload({
    illustrationUrls: userIllustrations,
    galleryDataUrls: productImageDataUrls,
    galleryUrls: productImageUrls,
  })
  const useVision = visionImages.length > 0

  const bulletBlock =
    bullets.length > 0 ? `Points fournisseur:\n${bullets.map((b) => `- ${b}`).join("\n")}` : ""

  const schema = `Réponds en JSON uniquement:
{
  "description": string (texte structuré SEO, 400-2200 caractères, sections avec titres en MAJUSCULES sur leur ligne, paragraphes séparés par double saut de ligne; pas de HTML; français commercial),
  "bulletPoints": string[] (4 à 6 puces courtes style marketplace, factuelles),
  "galleryImageIndices": number[] (optionnel, indices 0..n-1 UNIQUEMENT sur les photos galerie produit — pas les illustrations; max 4)
}

Structure obligatoire de description (titres exacts sur une ligne):
ACCROCHE
…
POUR QUI ?
…
POINTS FORTS
…
UTILISATION & ENTRETIEN
…
POURQUOI CE PRODUIT ?`

  const userText = [
    `Titre produit: ${title || "(à définir)"}`,
    `Catégorie: ${categoryPath || "(non définie)"}`,
    `Notes / brouillon description: ${notes || "(aucune)"}`,
    bulletBlock,
    userIllustrations.length > 0
      ? `Le fournisseur a déjà ${userIllustrations.length} image(s) d'illustration — ne pas inventer de fausses promesses sur le contenu des images.`
      : galleryPool.length > 0
        ? `Photos galerie uniquement (${galleryPool.length} image(s), indices 0 à ${galleryPool.length - 1}) pour galleryImageIndices — choisir les plus parlantes pour illustrer la fiche.`
        : "",
    schema,
  ]
    .filter(Boolean)
    .join("\n\n")

  const userContent:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      > = useVision
    ? [
        { type: "text", text: userText },
        ...visionImages.map((url) => ({
          type: "image_url" as const,
          image_url: { url },
        })),
      ]
    : userText

  let raw: string
  try {
    raw =
      (await groqChatText({
        model: useVision ? GROQ_VISION_MODEL : undefined,
        vision: useVision,
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Tu rédiges des fiches produit e-commerce optimisées SEO pour Affisell. Reste factuel; n'invente pas de certifications, avis clients ou garanties non mentionnées.",
          },
          { role: "user", content: userContent },
        ],
      })) ?? "{}"
  } catch (e: unknown) {
    throw e instanceof Error ? e : new Error(String(e))
  }

  let parsed: {
    description?: unknown
    bulletPoints?: unknown
    galleryImageIndices?: unknown
  }
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as typeof parsed
  } catch {
    throw new Error("Réponse IA invalide")
  }

  const description =
    typeof parsed.description === "string" ? parsed.description.trim().slice(0, 8000) : ""
  if (!description) {
    throw new Error("Description vide")
  }

  const bulletPoints = normalizeBullets(parsed.bulletPoints)
  const aiBullets = bulletPoints.length > 0 ? bulletPoints : bullets

  let illustrationImages: string[] = []
  let illustrationSource: GenerateDescriptionResult["illustrationSource"] = "none"

  if (userIllustrations.length > 0) {
    illustrationImages = userIllustrations
    illustrationSource = "kept_user"
  } else {
    const indices = Array.isArray(parsed.galleryImageIndices)
      ? parsed.galleryImageIndices.filter((n): n is number => typeof n === "number" && Number.isInteger(n))
      : []
    const fromGallery = pickGalleryIllustrations(
      productImageUrls,
      productImageDataUrls,
      indices
    )
    if (fromGallery.length > 0) {
      illustrationImages = fromGallery
      illustrationSource = "from_gallery"
    } else if (
      input.generateMissingIllustrations &&
      productImageDataUrls.length + productImageUrls.length > 0
    ) {
      const fallbackPool = [...productImageDataUrls, ...productImageUrls]
      illustrationImages = fallbackPool.slice(0, Math.min(3, fallbackPool.length))
      illustrationSource = "from_gallery"
    }
  }

  if (
    illustrationImages.length === 0 &&
    input.generateMissingIllustrations &&
    process.env.HF_TOKEN?.trim()
  ) {
    const generated = await generateLifestyleDataUrl(
      `${title || "product"}. ${notes.slice(0, 400)}`.trim()
    )
    if (generated) {
      illustrationImages = [generated]
      illustrationSource = "generated_hf"
    }
  }

  return {
    description,
    bulletPoints: aiBullets,
    illustrationImages,
    illustrationSource,
  }
}
