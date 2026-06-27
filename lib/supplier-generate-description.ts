import {
  normalizeImagePlacements,
  parseDescriptionSections,
} from "@/lib/description-structure"
import { pickDescriptionBlueprint, type DescriptionBlueprint } from "@/lib/description-blueprints"
import { groqChatText, GROQ_TEXT_MODEL, GROQ_VISION_MODEL, isGroqRateLimitError } from "@/lib/ai/groq-client"
import { GROQ_VISION_MAX_IMAGES } from "@/lib/ai/groq-vision"
import { generateImageWithHf } from "@/lib/ai/hf-image"
import { extractProductIdentityFromTitle } from "@/lib/listing-product-signal"

const MAX_DATA_URL_LEN = 1_400_000
const MAX_ILLUSTRATIONS = 4
const MAX_VISION_ILLUSTRATIONS = 3
const MIN_SECTIONS_WITH_BODY = 4
const MIN_SECTION_BODY_LEN = 20

export type ProductSpecRow = { label: string; value: string }

export type GenerateDescriptionRequest = {
  title: string
  notes: string
  bullets: string[]
  /** Category breadcrumb — tone/context only, must not change product facts */
  categoryPath: string
  productSpecs?: ProductSpecRow[]
  productImageUrls: string[]
  productImageDataUrls: string[]
  illustrationDataUrls: string[]
  generateMissingIllustrations?: boolean
}

export type GenerateDescriptionResult = {
  description: string
  bulletPoints: string[]
  illustrationImages: string[]
  illustrationSource: "kept_user" | "from_gallery" | "generated_hf" | "none"
  imagePlacements: Array<{
    section: string
    role: string
    caption: string
    imageIndex: number
  }>
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

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** True when text already has SEO section blocks (not a raw dump). */
export function hasStructuredDescriptionSections(text: string): boolean {
  const sections = parseDescriptionSections(text.trim())
  if (sections.length === 0) return false
  if (sections.length === 1 && sections[0]!.key === "NOTES") return false
  const filled = sections.filter((s) => s.body.trim().length >= MIN_SECTION_BODY_LEN)
  return filled.length >= MIN_SECTIONS_WITH_BODY
}

/** Detect comma-list / title echo drafts that pollute generation. */
export function isRawProductFeatureDump(text: string, title: string): boolean {
  const t = text.trim()
  if (t.length < 24) return false
  if (hasStructuredDescriptionSections(t)) return false

  const commas = (t.match(/,/g) ?? []).length
  const semicolons = (t.match(/;/g) ?? []).length
  if (commas + semicolons >= 4 && t.length < 800) return true

  const nt = normalizeText(t)
  const nTitle = normalizeText(title)
  if (nTitle.length >= 16 && nt.includes(nTitle.slice(0, Math.min(50, nTitle.length)))) {
    return true
  }

  if (/^(telephones?|smartphone|produit|article)\s/i.test(t) && commas >= 2) return true
  return false
}

function looksLikeSpecLabel(line: string): boolean {
  const words = line.split(/\s+/).filter(Boolean)
  if (line.length < 2 || line.length > 80) return false
  if (words.length > 12) return false
  if (words.length === 1) return false
  if (line.length > 55 && /[,;]/.test(line)) return false
  if (words.length >= 6 && !/^(type|mat[eé]riau|lieu|taille|couleur|origine|poids|dimension|marque|mod[eè]le)\b/i.test(line)) {
    return false
  }
  return true
}

function looksLikeSpecValue(line: string): boolean {
  return line.length >= 1 && line.length <= 240
}

/** Import scrapes: "Label: value" or label line + value line (AliExpress, 1688…). */
export function extractProductSpecsFromNotes(notes: string): ProductSpecRow[] {
  const lines = notes
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const specs: ProductSpecRow[] = []
  const seen = new Set<string>()

  const push = (label: string, value: string) => {
    const l = label.trim()
    const v = value.trim()
    if (!l || !v) return
    const key = normalizeText(l)
    if (seen.has(key)) return
    seen.add(key)
    specs.push({ label: l, value: v })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const colon = line.match(/^([^:]{2,80}):\s*(.+)$/)
    if (colon) {
      push(colon[1]!, colon[2]!)
      continue
    }
    if (i + 1 >= lines.length) continue
    const next = lines[i + 1]!
    if (looksLikeSpecLabel(line) && looksLikeSpecValue(next) && !looksLikeSpecLabel(next)) {
      push(line, next)
      i++
    }
  }

  return specs.slice(0, 24)
}

export function isSpecSheetDraftNotes(notes: string): boolean {
  return extractProductSpecsFromNotes(notes).length >= 2
}

function mergeProductSpecs(primary: ProductSpecRow[], extra: ProductSpecRow[]): ProductSpecRow[] {
  const out: ProductSpecRow[] = []
  const seen = new Set<string>()
  for (const row of [...primary, ...extra]) {
    const label = row.label.trim()
    const value = row.value.trim()
    if (!label || !value) continue
    const key = normalizeText(label)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ label, value })
    if (out.length >= 24) break
  }
  return out
}

/** Keep spec sheets and SEO sections; strip only raw keyword dumps. */
export function sanitizeDraftNotesForGeneration(notes: string, title: string): string {
  const n = notes.trim()
  if (!n) return ""
  if (isRawProductFeatureDump(n, title)) return ""
  if (hasStructuredDescriptionSections(n) || isSpecSheetDraftNotes(n)) {
    return n.slice(0, 2000)
  }
  if (n.length > 500) return ""
  return n.slice(0, 1200)
}

function buildFallbackDraftForRepair(input: {
  title: string
  productName: string
  specs: ProductSpecRow[]
  draftNotes: string
  bullets: string[]
}): string {
  const parts = [
    input.title ? `Titre: ${input.title}` : "",
    input.productName && input.productName !== input.title ? `Produit: ${input.productName}` : "",
    input.specs.length
      ? `Caractéristiques:\n${input.specs.map((s) => `- ${s.label}: ${s.value}`).join("\n")}`
      : "",
    input.bullets.length ? `Points:\n${input.bullets.map((b) => `- ${b}`).join("\n")}` : "",
    input.draftNotes ? `Notes fournisseur:\n${input.draftNotes}` : "",
  ].filter(Boolean)
  return parts.join("\n\n").slice(0, 2400)
}

async function recoverEmptyDescription(input: {
  title: string
  productName: string
  specs: ProductSpecRow[]
  bullets: string[]
  draftNotes: string
}): Promise<string | null> {
  const fallbackDraft = buildFallbackDraftForRepair(input)
  if (!fallbackDraft.trim()) return null

  const repaired = await repairUnstructuredDescription({
    title: input.title,
    productName: input.productName,
    specs: input.specs,
    bullets: input.bullets,
    badOutput: fallbackDraft,
  })
  if (repaired?.trim()) return repaired.trim().slice(0, 8000)
  return null
}

/** Build Groq prompt for structured SEO description generation. */
export function buildDescriptionGenerationPrompt(input: {
  title: string
  productName: string
  categoryPath: string
  specs: ProductSpecRow[]
  bullets: string[]
  draftNotes: string
  galleryCount: number
  variationNonce?: number
}): { system: string; user: string; blueprint: DescriptionBlueprint } {
  const blueprint = pickDescriptionBlueprint({
    title: input.title,
    categoryPath: input.categoryPath,
    variationNonce: input.variationNonce,
  })
  const sectionList = blueprint.sections.join("\n")

  const specBlock =
    input.specs.length > 0
      ? `Spécifications techniques (faits à intégrer):\n${input.specs.map((s) => `- ${s.label}: ${s.value}`).join("\n")}`
      : ""

  const bulletBlock =
    input.bullets.length > 0
      ? `Points clés fournisseur:\n${input.bullets.map((b) => `- ${b}`).join("\n")}`
      : ""

  const system = `Tu es le rédacteur premium Affisell (Studio copy). Tu produis des fiches produit e-commerce en français:
- Professionnelles, détaillées, optimisées SEO, orientées conversion.
- Basées sur le TITRE et les SPECS — jamais sur une liste brute de mots-clés.
- La catégorie indique le ton du rayon UNIQUEMENT — ne change pas le type de produit, n'invente pas d'autres rayons.
- N'invente pas de certifications, avis, garanties ou chiffres absents des sources.
- Chaque section = 2 à 4 phrases fluides (pas de listes à virgules dans le corps).
- Varie le vocabulaire, les accroches et la longueur des paragraphes à chaque génération — jamais de copier-coller générique entre produits.
- Adapte le ton et les sous-titres implicites au type de produit (tech, mode, maison, beauté…).`

  const user = [
    "═══ PRIORITÉ 1 — PRODUIT (TITRE) ═══",
    `Titre listing: ${input.title}`,
    `Nom produit: ${input.productName}`,
    "",
    specBlock,
    bulletBlock,
    input.draftNotes ? `Brouillon structuré existant (à améliorer, pas recopier tel quel):\n${input.draftNotes}` : "",
    input.categoryPath
      ? `Contexte rayon (ton seulement, ne pas recatégoriser): ${input.categoryPath}`
      : "",
    input.galleryCount > 0
      ? `Photos galerie disponibles: ${input.galleryCount} (indices 0..${input.galleryCount - 1})`
      : "",
    "",
    `Plan éditorial (${blueprint.id}) — angle: ${blueprint.angle}`,
    "",
    "Réponds en JSON uniquement:",
    `{`,
    `  "description": string,`,
    `  "bulletPoints": string[],`,
    `  "galleryImageIndices": number[],`,
    `  "imagePlacements": { "section": string, "role": "hero"|"lifestyle"|"detail"|"scale"|"packaging", "caption": string, "imageIndex": number }[]`,
    `}`,
    "",
    "Structure OBLIGATOIRE de description (titres EXACTS, une ligne chacun, corps en paragraphes):",
    sectionList,
    "",
    "Exigences:",
    "- 900 à 2200 caractères au total, français commercial premium.",
    "- Respecte l'angle du plan éditorial — ne force pas une structure générique si le plan propose autre chose.",
    "- Première section = bénéfice principal percutant (titre exact ci-dessus, pas « ACCROCHE » si absent du plan).",
    "- Sections techniques = specs traduites en avantages client concrets.",
    "- Pas de HTML. Double saut de ligne entre sections.",
    "- bulletPoints: 4 à 6 puces courtes factuelles (max 120 car. chacune), formulées différemment des titres de sections.",
  ]
    .filter(Boolean)
    .join("\n")

  return { system, user, blueprint }
}

/** Vision burns scout TPD — skip when title/specs/notes already describe the product. */
export function shouldUseVisionForDescription(input: {
  specs: ProductSpecRow[]
  draftNotes: string
  bullets: string[]
  title: string
  visionImageCount: number
}): boolean {
  if (input.visionImageCount === 0) return false
  const richContext =
    input.specs.length >= 1 ||
    input.draftNotes.length >= 24 ||
    input.bullets.length >= 1 ||
    input.title.trim().length >= 8
  return !richContext
}

function appendSkippedVisionNote(user: string, illustrationCount: number, galleryCount: number): string {
  if (illustrationCount === 0 && galleryCount === 0) return user
  return [
    user,
    "",
    `Visuels fournis (${illustrationCount} illustration(s), ${galleryCount} photo(s) galerie) — intègre-les dans imagePlacements sans inventer de détails visuels non mentionnés dans le titre/specs.`,
  ].join("\n")
}

async function callDescriptionModel(
  system: string,
  user: string,
  visionImages: string[]
): Promise<string> {
  const useVision = visionImages.length > 0
  const userContent = useVision
    ? [
        { type: "text" as const, text: user },
        ...visionImages.map((url) => ({
          type: "image_url" as const,
          image_url: { url },
        })),
      ]
    : user

  return (
    (await groqChatText({
      model: useVision ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
      vision: useVision,
      temperature: 0.44,
      max_tokens: 2800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    })) ?? "{}"
  )
}

async function callDescriptionModelSafe(
  system: string,
  user: string,
  visionImages: string[],
  preferVision: boolean
): Promise<string> {
  const tryVision = preferVision && visionImages.length > 0
  try {
    return await callDescriptionModel(system, user, tryVision ? visionImages : [])
  } catch (err) {
    if (tryVision && isGroqRateLimitError(err)) {
      console.log("[supplier-generate-description]", { event: "vision_rate_limit_text_fallback" })
      return await callDescriptionModel(system, user, [])
    }
    throw err instanceof Error ? err : new Error(String(err))
  }
}

async function repairUnstructuredDescription(input: {
  title: string
  productName: string
  specs: ProductSpecRow[]
  bullets: string[]
  badOutput: string
  blueprint?: DescriptionBlueprint
}): Promise<string | null> {
  const blueprint =
    input.blueprint ??
    pickDescriptionBlueprint({ title: input.title, categoryPath: "" })
  const sectionList = blueprint.sections.join("\n")
  const raw = await groqChatText({
    model: GROQ_TEXT_MODEL,
    temperature: 0.2,
    max_tokens: 2800,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Tu restructures des fiches produit Affisell. Transforme tout brouillon en description SEO structurée en français. JSON uniquement.",
      },
      {
        role: "user",
        content: [
          `Produit: ${input.productName || input.title}`,
          `Titre: ${input.title}`,
          input.specs.length
            ? `Specs:\n${input.specs.map((s) => `- ${s.label}: ${s.value}`).join("\n")}`
            : "",
          input.bullets.length ? `Puces:\n${input.bullets.map((b) => `- ${b}`).join("\n")}` : "",
          `Brouillon à restructurer (NE PAS recopier en liste à virgules):\n${input.badOutput.slice(0, 1200)}`,
          "",
          `Réponds: {"description": string} avec titres EXACTS:\n${sectionList}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  })

  if (!raw) return null
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as { description?: unknown }
    return typeof parsed.description === "string" ? parsed.description.trim() : null
  } catch {
    return null
  }
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
  const { productName } = extractProductIdentityFromTitle(title)
  const rawNotes = input.notes.trim()
  const draftNotes = sanitizeDraftNotesForGeneration(rawNotes, title)
  const bullets = input.bullets.map((s) => s.trim()).filter(Boolean).slice(0, 6)
  const categoryPath = input.categoryPath.trim().slice(0, 500)
  const specs = mergeProductSpecs(
    (input.productSpecs ?? []).filter((s) => s.label.trim() && s.value.trim()),
    extractProductSpecsFromNotes(rawNotes)
  )

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

  const variationNonce = Date.now()

  const { system, user: baseUser, blueprint } = buildDescriptionGenerationPrompt({
    title,
    productName: productName || title,
    categoryPath,
    specs,
    bullets,
    draftNotes,
    galleryCount: galleryPool.length,
    variationNonce,
  })

  console.log("[supplier-generate-description]", {
    event: "blueprint_picked",
    blueprintId: blueprint.id,
    family: blueprint.family,
    sectionCount: blueprint.sections.length,
  })

  const preferVision = shouldUseVisionForDescription({
    specs,
    draftNotes,
    bullets,
    title,
    visionImageCount: visionImages.length,
  })
  const user = preferVision
    ? baseUser
    : appendSkippedVisionNote(baseUser, userIllustrations.length, galleryPool.length)

  let raw: string
  try {
    raw = await callDescriptionModelSafe(system, user, visionImages, preferVision)
  } catch (e: unknown) {
    if (isGroqRateLimitError(e)) {
      console.log("[supplier-generate-description]", { event: "rate_limit_recover_local" })
      const recovered = await recoverEmptyDescription({
        title,
        productName: productName || title,
        specs,
        bullets,
        draftNotes: draftNotes || rawNotes.slice(0, 2000),
      })
      if (recovered) {
        return {
          description: recovered,
          bulletPoints: bullets,
          illustrationImages: userIllustrations,
          illustrationSource: userIllustrations.length > 0 ? "kept_user" : "none",
          imagePlacements: [],
        }
      }
    }
    throw e instanceof Error ? e : new Error(String(e))
  }

  let parsed: {
    description?: unknown
    bulletPoints?: unknown
    galleryImageIndices?: unknown
    imagePlacements?: unknown
  }
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as typeof parsed
  } catch {
    throw new Error("Réponse IA invalide")
  }

  let description =
    typeof parsed.description === "string" ? parsed.description.trim().slice(0, 8000) : ""

  if (!description && visionImages.length > 0 && preferVision) {
    console.log("[supplier-generate-description]", {
      event: "empty_description_retry_text",
      title,
      specCount: specs.length,
    })
    try {
      const retryRaw = await callDescriptionModel(system, user, [])
      const retryParsed = JSON.parse(stripJsonFence(retryRaw)) as typeof parsed
      parsed = retryParsed
      description =
        typeof retryParsed.description === "string"
          ? retryParsed.description.trim().slice(0, 8000)
          : ""
    } catch (retryErr) {
      console.error("[supplier-generate-description] text retry failed", retryErr)
    }
  }

  if (!description) {
    console.log("[supplier-generate-description]", {
      event: "empty_description_recover",
      title,
      specCount: specs.length,
      draftLen: draftNotes.length,
    })
    description =
      (await recoverEmptyDescription({
        title,
        productName: productName || title,
        specs,
        bullets,
        draftNotes: draftNotes || rawNotes.slice(0, 2000),
      })) ?? ""
  }

  if (!description) {
    throw new Error(
      "Impossible de générer la description avec les informations fournies. Complétez les specs ou réessayez."
    )
  }

  if (!hasStructuredDescriptionSections(description)) {
    const repaired = await repairUnstructuredDescription({
      title,
      productName: productName || title,
      specs,
      bullets,
      badOutput: description,
      blueprint,
    })
    if (repaired && hasStructuredDescriptionSections(repaired)) {
      description = repaired.slice(0, 8000)
    } else if (repaired) {
      description = repaired.slice(0, 8000)
    } else {
      throw new Error(
        "La description générée n'est pas structurée. Réessayez ou complétez les specs produit."
      )
    }
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
    const fromGallery = pickGalleryIllustrations(productImageUrls, productImageDataUrls, indices)
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
    const generated = await generateLifestyleDataUrl(`${productName || title}. ${specs.map((s) => s.value).join(", ").slice(0, 200)}`.trim())
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
    imagePlacements: normalizeImagePlacements(parsed.imagePlacements),
  }
}
