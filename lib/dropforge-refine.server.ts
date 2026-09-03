import "server-only"

import { groqChatText } from "@/lib/ai/groq-client"
import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { createAliExpressClient } from "@/lib/aliexpress-open-api"
import type { DropForgeCompletePreview } from "@/lib/dropforge-complete-import"
import {
  auditDropForgePreview,
  dropForgeRefineQuickPrompt,
  type DropForgePreviewGap,
  type DropForgeRefineQuickAction,
} from "@/lib/dropforge-refine-audit"
import {
  applyDropForgeRefinePatch,
  type DropForgeRefinePatch,
} from "@/lib/dropforge-refine-patch"
import { parseAeProductSkusFromPayload } from "@/lib/fulfillment/ae-product-skus"
import { absolutizeCdnImageUrl } from "@/lib/cdn-image-url"

export type DropForgeRefineResult = {
  preview: DropForgeCompletePreview
  message: string
  applied: string[]
  gaps: DropForgePreviewGap[]
  warnings: string[]
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function parsePatchJson(raw: string): {
  patch: DropForgeRefinePatch
  assistantMessage: string
  stillMissing: string[]
} | null {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced ?? trimmed
  try {
    const o = asRecord(JSON.parse(candidate))
    if (!o) return null
    const patchRaw = asRecord(o.patch) ?? o
    const patch: DropForgeRefinePatch = {}

    if (typeof patchRaw.title === "string") patch.title = patchRaw.title
    if (typeof patchRaw.description === "string") patch.description = patchRaw.description
    if (typeof patchRaw.brand === "string") patch.brand = patchRaw.brand
    if (typeof patchRaw.category === "string") patch.category = patchRaw.category
    if (typeof patchRaw.costPrice === "number") patch.costPrice = patchRaw.costPrice

    if (Array.isArray(patchRaw.addImages)) {
      patch.addImages = patchRaw.addImages.filter(
        (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)
      )
    }

    if (Array.isArray(patchRaw.addSpecs)) {
      /* ignore wrong shape */
    } else if (patchRaw.addSpecs && typeof patchRaw.addSpecs === "object") {
      patch.addSpecs = {}
      for (const [k, v] of Object.entries(patchRaw.addSpecs as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) patch.addSpecs[k] = v.trim()
      }
    }

    if (Array.isArray(patchRaw.addSizes)) {
      patch.addSizes = patchRaw.addSizes.filter((s): s is string => typeof s === "string")
    }

    if (Array.isArray(patchRaw.addColors)) {
      patch.addColors = patchRaw.addColors
        .map((c) => asRecord(c))
        .filter(Boolean)
        .map((c) => ({
          name: String(c!.name ?? ""),
          hex: typeof c!.hex === "string" ? c!.hex : undefined,
          image: typeof c!.image === "string" ? c!.image : undefined,
        }))
        .filter((c) => c.name.trim())
    }

    if (Array.isArray(patchRaw.addVariants)) {
      patch.addVariants = patchRaw.addVariants
        .map((v) => asRecord(v))
        .filter(Boolean)
        .map((v) => ({
          name: String(v!.name ?? ""),
          type: typeof v!.type === "string" ? v!.type : undefined,
          price: typeof v!.price === "number" ? v!.price : undefined,
          stock: typeof v!.stock === "number" ? v!.stock : undefined,
          sku: typeof v!.sku === "string" ? v!.sku : undefined,
          image: typeof v!.image === "string" ? v!.image : undefined,
        }))
        .filter((v) => v.name.trim())
    }

    if (Array.isArray(patchRaw.addTags)) {
      patch.addTags = patchRaw.addTags.filter((t): t is string => typeof t === "string")
    }

    const assistantMessage =
      (typeof o.assistantMessage === "string" && o.assistantMessage.trim()) ||
      (typeof o.message === "string" && o.message.trim()) ||
      "Fiche mise à jour."

    const stillMissing = Array.isArray(o.stillMissing)
      ? o.stillMissing.filter((s): s is string => typeof s === "string").slice(0, 8)
      : []

    return { patch, assistantMessage, stillMissing }
  } catch {
    return null
  }
}

function instructionWantsApiTopUp(instruction: string, quickAction?: DropForgeRefineQuickAction): boolean {
  if (quickAction === "images" || quickAction === "variants") return true
  const m = instruction.toLowerCase()
  return (
    /image|galerie|photo|variant|couleur|taille|sku|aliexpress|api|source/.test(m) &&
    !/http/.test(m)
  )
}

/** Merge missing gallery / variants from AliExpress DS API (partial, no full re-import). */
export async function topUpDropForgePreviewFromAliExpressApi(
  preview: DropForgeCompletePreview
): Promise<{ preview: DropForgeCompletePreview; applied: string[]; warning?: string }> {
  const aeId =
    preview.aliexpressProductId?.trim() ||
    parseAliExpressProductId(preview.sourceUrl) ||
    ""
  if (!aeId) {
    return { preview, applied: [], warning: "Pas d'ID AliExpress — complément API impossible." }
  }

  const applied: string[] = []
  const warnings: string[] = []

  try {
    const client = await createAliExpressClient()
    const raw = await client.getProduct(aeId)
    const mapped = mapAliExpressGetProductResponse(raw, aeId)
    const aeSkus = parseAeProductSkusFromPayload(raw, aeId)

    let patch: DropForgeRefinePatch = {}

    const newImages = mapped.images.filter((u) => !preview.images.includes(u))
    if (newImages.length > 0) {
      patch.addImages = newImages
      applied.push("api:images")
    }

    const addSpecs: Record<string, string> = {}
    for (const [k, v] of Object.entries(mapped.specs)) {
      if (v?.trim() && !preview.specs[k]) addSpecs[k] = v.trim()
    }
    if (Object.keys(addSpecs).length > 0) {
      patch.addSpecs = addSpecs
      applied.push("api:specs")
    }

    if (!preview.description?.trim() && mapped.description?.trim()) {
      patch.description = mapped.description
      applied.push("api:description")
    }

    if (aeSkus.length > (preview.variants?.length ?? 0)) {
      patch.addVariants = aeSkus
        .filter((s) => s.aeSkuId)
        .slice(0, 80)
        .map((s) => ({
          name: s.aeLabel || s.aeSkuId,
          sku: s.aeSkuId,
          price: s.aePriceCents > 0 ? s.aePriceCents / 100 : preview.costPrice,
          stock: s.stock,
          image: s.imageUrl ? absolutizeCdnImageUrl(s.imageUrl) ?? s.imageUrl : "",
          attributes: {
            ...(s.matchColor ? { Couleur: s.matchColor } : {}),
            ...(s.matchSize ? { Taille: s.matchSize } : {}),
          },
        }))
      applied.push("api:variants")
    }

    if (mapped.basePriceCents > 0 && preview.costPrice <= 0) {
      patch.costPrice = mapped.basePriceCents / 100
      applied.push("api:costPrice")
    }

    if (Object.keys(patch).length === 0) {
      return {
        preview,
        applied: [],
        warning: "API AliExpress OK — rien de nouveau à fusionner.",
      }
    }

    const merged = applyDropForgeRefinePatch(preview, patch)
    return { preview: merged.preview, applied: [...applied, ...merged.applied] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    warnings.push(msg.slice(0, 160))
    console.log("[dropforge-refine]", { stage: "api-topup", aeId, result: "fail", error: msg.slice(0, 160) })
    return { preview, applied: [], warning: msg.slice(0, 200) }
  }
}

async function refineWithGroq(args: {
  preview: DropForgeCompletePreview
  instruction: string
  gaps: DropForgePreviewGap[]
}): Promise<{
  patch: DropForgeRefinePatch
  assistantMessage: string
  stillMissing: string[]
} | null> {
  if (!process.env.GROQ_API_KEY?.trim()) return null

  const compact = {
    title: args.preview.title,
    description: args.preview.description.slice(0, 800),
    brand: args.preview.brand,
    category: args.preview.category,
    costPrice: args.preview.costPrice,
    imageCount: args.preview.images.length,
    sampleImages: args.preview.images.slice(0, 3),
    variantCount: args.preview.variants.length,
    variantNames: args.preview.variants.slice(0, 12).map((v) => v.name),
    colors: args.preview.colors.map((c) => c.name),
    sizes: args.preview.sizes,
    specs: args.preview.specs,
    sourceUrl: args.preview.sourceUrl,
    marketplace: args.preview.marketplaceLabel,
    gaps: args.gaps.map((g) => g.hint),
  }

  const raw = await groqChatText({
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are DropForge Co-Pilot on Affisell. Patch an EXISTING import — never ask to re-scrape.
Output ONLY JSON:
{
  "patch": {
    "title"?: string,
    "description"?: string,
    "brand"?: string,
    "category"?: string,
    "costPrice"?: number,
    "addImages"?: string[] (ONLY URLs user pasted in instruction — never invent CDN URLs),
    "addSpecs"?: Record<string,string>,
    "addSizes"?: string[],
    "addColors"?: [{"name","hex?","image?"}],
    "addVariants"?: [{"name","sku?","price?","stock?","image?","attributes?"}],
    "addTags"?: string[]
  },
  "assistantMessage": string (French, concise, what you changed),
  "stillMissing": string[] (French — what user must still provide manually)
}
Rules: factual only, French commercial copy, no fake CE/warranty claims. Prefer patching text/specs over inventing images.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          instruction: args.instruction,
          currentPreview: compact,
        }),
      },
    ],
  })

  if (!raw) return null
  return parsePatchJson(raw)
}

/**
 * Refine DropForge preview in-place from natural language (no full re-import).
 */
export async function refineDropForgePreview(args: {
  preview: DropForgeCompletePreview
  instruction: string
  quickAction?: DropForgeRefineQuickAction
  locale?: "fr" | "en"
}): Promise<
  | { ok: true; result: DropForgeRefineResult }
  | { ok: false; error: string; status: number }
> {
  const instruction =
    args.instruction.trim() ||
    (args.quickAction ? dropForgeRefineQuickPrompt(args.quickAction, args.locale ?? "fr") : "")
  if (!instruction) {
    return { ok: false, error: "Instruction vide — décrivez ce qui manque.", status: 400 }
  }

  let preview: DropForgeCompletePreview = { ...args.preview, warnings: [...(args.preview.warnings ?? [])] }
  const appliedAll: string[] = []
  const warnings: string[] = []

  if (instructionWantsApiTopUp(instruction, args.quickAction)) {
    const topUp = await topUpDropForgePreviewFromAliExpressApi(preview)
    preview = topUp.preview
    appliedAll.push(...topUp.applied)
    if (topUp.warning) warnings.push(topUp.warning)
  }

  const gapsBefore = auditDropForgePreview(preview)
  const groq = await refineWithGroq({ preview, instruction, gaps: gapsBefore })

  if (groq) {
    const merged = applyDropForgeRefinePatch(preview, groq.patch)
    preview = merged.preview as DropForgeCompletePreview
    appliedAll.push(...merged.applied.map((a) => `ai:${a}`))
    if (groq.stillMissing.length) {
      warnings.push(...groq.stillMissing.map((s) => `Encore requis : ${s}`))
    }
    const gaps = auditDropForgePreview(preview)
    console.log("[dropforge-refine]", {
      sourceUrl: preview.sourceUrl.slice(0, 80),
      applied: appliedAll,
      gapCount: gaps.length,
      result: "ok",
    })
    return {
      ok: true,
      result: {
        preview,
        message: groq.assistantMessage,
        applied: appliedAll,
        gaps,
        warnings,
      },
    }
  }

  if (appliedAll.length > 0) {
    const gaps = auditDropForgePreview(preview)
    return {
      ok: true,
      result: {
        preview,
        message: "Complément API appliqué (GROQ_API_KEY absente — édition IA désactivée).",
        applied: appliedAll,
        gaps,
        warnings,
      },
    }
  }

  return {
    ok: false,
    error: "Co-Pilot indisponible — configurez GROQ_API_KEY ou précisez des URLs images à ajouter.",
    status: 503,
  }
}
