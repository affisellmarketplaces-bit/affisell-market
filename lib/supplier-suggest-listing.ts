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
  isCategorySuggestionViable,
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

const MIN_KEYWORD_SCORE_FOR_MERGE = 7

function mergeSuggestionsByTitleRelevance(
  title: string,
  description: string,
  aiPicks: LeafPath[],
  keywordPicks: LeafPath[],
  limit: number
): LeafPath[] {
  const text = `${title} ${description}`.trim()
  const seen = new Set<string>()
  const pushUnique = (lp: LeafPath, out: LeafPath[]) => {
    if (seen.has(lp.leafId)) return
    seen.add(lp.leafId)
    out.push(lp)
  }

  const topAi = aiPicks[0]
  const topKw = keywordPicks[0]
  const aiScore = topAi ? scoreProductTextAgainstBreadcrumb(text, topAi.breadcrumb) : 0
  const kwScore = topKw ? scoreProductTextAgainstBreadcrumb(text, topKw.breadcrumb) : 0

  /** Keep Groq order when keyword ranking would promote false "voiture" / pet matches. */
  const preferAiOrder =
    aiPicks.length > 0 &&
    aiScore >= MIN_KEYWORD_SCORE_FOR_MERGE &&
    (kwScore < MIN_KEYWORD_SCORE_FOR_MERGE || aiScore >= kwScore * 0.8)

  if (preferAiOrder) {
    const out: LeafPath[] = []
    for (const lp of aiPicks) pushUnique(lp, out)
    for (const lp of keywordPicks) {
      if (out.length >= limit) break
      pushUnique(lp, out)
    }
    return out.slice(0, limit)
  }

  const combined: LeafPath[] = []
  for (const lp of [...aiPicks, ...keywordPicks]) pushUnique(lp, combined)

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
- Do not let a single generic substring (air, pro, mini, max, note, voiture, car) override the main noun (laptop, phone, headphones, camera, lamp, etc.).
- Dashcams / "caméra de voiture" / multi-channel car DVR → vehicle electronics camera leaves (e.g. Caméras de recul, Électronique pour véhicules), never pet car barriers, car user manuals, garden carports, or toy vehicles.
- Prefer the closest real leaf: computers and similar go under Computers / Laptops / PCs when present, not kitchen or fragrance.
- If DESCRIPTION is provided, use it together with the title.
- Smart bands, fitness trackers, connected watches/bracelets → activity / biometric monitor leaves, never phone unlock categories, electronic connectors, or white-noise sleep aids.
- CarPlay / Android Auto / wireless car adapters / in-dash screens → Véhicules > Électronique pour véhicules (audio/video intégré, mains-libres, GPS auto). NEVER prepaid SIM cards, phone plans, or generic phone accessories.
- "Car" in CarPlay is not a SIM card or prepaid phone card — ignore téléphonie > cartes prépayées branches.

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

    const text = `${t} ${d}`.trim()
    const picked: LeafPath[] = []
    const seen = new Set<string>()
    for (const id of ids) {
      if (picked.length >= 3) break
      const lp = allowed.get(id)
      if (
        lp &&
        !seen.has(lp.leafId) &&
        isCategorySuggestionViable(text, lp.breadcrumb)
      ) {
        seen.add(lp.leafId)
        picked.push(lp)
      }
    }

    const viableKeywords = keywordFallback.filter((lp) =>
      isCategorySuggestionViable(text, lp.breadcrumb)
    )
    const merged = mergeSuggestionsByTitleRelevance(
      t,
      d,
      picked,
      viableKeywords.length > 0 ? viableKeywords : keywordFallback,
      3
    )
    type ScoredSuggestion = ListingCategorySuggestion & { relevanceScore: number }
    let scored: ScoredSuggestion[] = merged.map((lp) => {
      const s = scoreProductTextAgainstBreadcrumb(text, lp.breadcrumb)
      const tie = picked.findIndex((p) => p.leafId === lp.leafId)
      const confidence =
        tie === 0 ? 0.88 : tie > 0 ? 0.75 - tie * 0.08 : Math.min(0.72, 0.35 + s / 40)
      return { ...lp, confidence, relevanceScore: s }
    })
    scored = scored.filter(
      (row) =>
        isCategorySuggestionViable(text, row.breadcrumb) &&
        (row.relevanceScore >= MIN_KEYWORD_SCORE_FOR_MERGE || (row.confidence ?? 0) >= 0.75)
    )
    if (scored.length === 0 && keywordFallback.length > 0) {
      scored = keywordFallback.slice(0, 3).map((lp) => {
        const s = scoreProductTextAgainstBreadcrumb(text, lp.breadcrumb)
        return { ...lp, confidence: Math.min(0.72, 0.35 + s / 40), relevanceScore: s }
      })
    }
    const suggestions: ListingCategorySuggestion[] = scored.map(({ relevanceScore: _rs, ...lp }) => lp)

    const topScore = merged[0]
      ? scoreProductTextAgainstBreadcrumb(text, merged[0].breadcrumb)
      : 0

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
      recommendedLeafId:
        suggestions[0] && topScore >= MIN_KEYWORD_SCORE_FOR_MERGE ? suggestions[0].leafId : null,
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
