import { groqChatText } from "@/lib/ai/groq-client"
import {
  buildCategoryBrowse,
  fetchAllCategoriesForBrowse,
  leafPathsForAiCatalog,
  scoreProductTextAgainstBreadcrumb,
  suggestLeafCategoriesFromProductText,
  type LeafPath,
} from "@/lib/category-browse"
import {
  findWearableCategoryAlternatives,
  type CategoryAlternativeSuggestion,
} from "@/lib/category-title-match"
import type { PrismaClient } from "@prisma/client"

export type ListingCategorySuggestion = LeafPath & {
  confidence?: number
}

export type SuggestListingCategoriesResult = {
  suggestions: ListingCategorySuggestion[]
  /** e.g. Bijoux > Montres when primary is activity monitor */
  alternatives: CategoryAlternativeSuggestion[]
  recommendedLeafId: string | null
  source: "none" | "empty" | "keyword" | "ai" | "hybrid"
}

function mergeSuggestionsByTitleRelevance(
  title: string,
  description: string,
  aiPicks: LeafPath[],
  keywordPicks: LeafPath[],
  limit: number
): LeafPath[] {
  const text = `${title} ${description}`.trim()
  const seen = new Set<string>()
  const combined: LeafPath[] = []
  for (const lp of [...aiPicks, ...keywordPicks]) {
    if (seen.has(lp.leafId)) continue
    seen.add(lp.leafId)
    combined.push(lp)
  }
  const aiRank = new Map<string, number>()
  aiPicks.forEach((lp, i) => aiRank.set(lp.leafId, aiPicks.length - i))
  return combined
    .map((lp) => ({
      lp,
      s: scoreProductTextAgainstBreadcrumb(text, lp.breadcrumb),
      tie: aiRank.get(lp.leafId) ?? 0,
    }))
    .sort((a, b) => (b.s !== a.s ? b.s - a.s : b.tie - a.tie))
    .map((x) => x.lp)
    .slice(0, limit)
}

const GROQ_SYSTEM = `You are an Affisell marketplace merchandiser. Map the listing to exactly 3 leaf categories from the ALLOWED list only (each line: CATEGORY_ID<TAB>breadcrumb).

Rules:
- Infer the primary product type from the full title (e.g. a "MacBook Air" or "iPad Air" is a laptop/tablet computer, not air fryers, air fresheners, or unrelated "air" products).
- Do not let a single generic substring (air, pro, mini, max, note) override the main noun (laptop, phone, headphones, lamp, etc.).
- Prefer the closest real leaf: computers and similar go under Computers / Laptops / PCs when present, not kitchen or fragrance.
- If DESCRIPTION is provided, use it together with the title.
- Smart bands, fitness trackers, connected watches/bracelets → activity / biometric monitor leaves, never phone unlock categories, electronic connectors, or white-noise sleep aids.

Return JSON: {"ids":["id1","id2","id3"]} — only IDs from the list, no invented IDs, no duplicates, best match first.`

/** Single entry point: category suggestions for supplier listing (keyword + optional Groq). */
export async function suggestListingCategories(
  title: string,
  description: string,
  client: PrismaClient
): Promise<SuggestListingCategoriesResult> {
  const t = title.trim()
  const d = description.trim()

  if (t.length < 2) {
    return { suggestions: [], alternatives: [], recommendedLeafId: null, source: "none" }
  }

  const rows = await fetchAllCategoriesForBrowse(client)
  const { leafPaths } = buildCategoryBrowse(rows)

  if (leafPaths.length === 0) {
    return { suggestions: [], alternatives: [], recommendedLeafId: null, source: "empty" }
  }

  const keywordFallback = suggestLeafCategoriesFromProductText(t, d, leafPaths, 6)

  if (!process.env.GROQ_API_KEY?.trim()) {
    const suggestions = keywordFallback.slice(0, 3).map((lp) => ({ ...lp }))
    const alternatives = findWearableCategoryAlternatives(t, d, leafPaths, suggestions)
    return {
      suggestions,
      alternatives,
      recommendedLeafId: suggestions[0]?.leafId ?? null,
      source: "keyword",
    }
  }

  const catalogLeaves = leafPathsForAiCatalog(leafPaths, t, d)
  const allowed = new Map<string, LeafPath>()
  const lines: string[] = []
  for (const lp of catalogLeaves) {
    allowed.set(lp.leafId, lp)
    lines.push(`${lp.leafId}\t${lp.breadcrumb}`)
  }

  try {
    const raw =
      (await groqChatText({
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: GROQ_SYSTEM },
          {
            role: "user",
            content: `TITLE: ${t}\n${d ? `DESCRIPTION: ${d}\n` : ""}\nALLOWED (id<TAB>breadcrumb):\n${lines.join("\n")}`,
          },
        ],
      })) ?? "{}"

    let ids: string[] = []
    try {
      const parsed = JSON.parse(raw) as { ids?: unknown }
      if (Array.isArray(parsed.ids)) {
        ids = parsed.ids.filter((x): x is string => typeof x === "string").map((s) => s.trim())
      }
    } catch {
      ids = []
    }

    const picked: LeafPath[] = []
    const seen = new Set<string>()
    for (const id of ids) {
      if (picked.length >= 3) break
      const lp = allowed.get(id)
      if (lp && !seen.has(lp.leafId)) {
        seen.add(lp.leafId)
        picked.push(lp)
      }
    }

    const merged = mergeSuggestionsByTitleRelevance(t, d, picked, keywordFallback, 3)
    const text = `${t} ${d}`.trim()
    const suggestions: ListingCategorySuggestion[] = merged.map((lp, i) => {
      const s = scoreProductTextAgainstBreadcrumb(text, lp.breadcrumb)
      const tie = picked.findIndex((p) => p.leafId === lp.leafId)
      const confidence =
        tie === 0 ? 0.88 : tie > 0 ? 0.75 - tie * 0.08 : Math.min(0.72, 0.35 + s / 40)
      return { ...lp, confidence }
    })

    const source =
      picked.length >= 2 && merged.every((lp, i) => picked[i]?.leafId === lp.leafId)
        ? ("ai" as const)
        : picked.length > 0
          ? ("hybrid" as const)
          : ("keyword" as const)

    const alternatives = findWearableCategoryAlternatives(t, d, leafPaths, suggestions)

    return {
      suggestions,
      alternatives,
      recommendedLeafId: suggestions[0]?.leafId ?? null,
      source,
    }
  } catch {
    const suggestions = keywordFallback.slice(0, 3).map((lp) => ({ ...lp }))
    const alternatives = findWearableCategoryAlternatives(t, d, leafPaths, suggestions)
    return {
      suggestions,
      alternatives,
      recommendedLeafId: suggestions[0]?.leafId ?? null,
      source: "keyword",
    }
  }
}
