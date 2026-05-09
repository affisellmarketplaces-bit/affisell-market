import { NextResponse } from "next/server"
import OpenAI from "openai"

import { auth } from "@/auth"
import {
  buildCategoryBrowse,
  fetchAllCategoriesForBrowse,
  leafPathsForAiCatalog,
  scoreTitleAgainstBreadcrumb,
  suggestLeafCategoriesFromTitle,
  type LeafPath,
} from "@/lib/category-browse"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
      s: scoreTitleAgainstBreadcrumb(text, lp.breadcrumb),
      tie: aiRank.get(lp.leafId) ?? 0,
    }))
    .sort((a, b) => (b.s !== a.s ? b.s - a.s : b.tie - a.tie))
    .map((x) => x.lp)
    .slice(0, limit)
}

/**
 * Maps a product title (and optional description) to up to 3 leaf categories from the live DB tree,
 * using OpenAI when configured — otherwise falls back to keyword scoring.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: unknown
    description?: unknown
  }
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const description = typeof body.description === "string" ? body.description.trim() : ""

  if (title.length < 2) {
    return NextResponse.json({ suggestions: [], source: "none" as const })
  }

  const rows = await fetchAllCategoriesForBrowse(prisma)
  const { leafPaths } = buildCategoryBrowse(rows)

  if (leafPaths.length === 0) {
    return NextResponse.json({ suggestions: [], source: "empty" as const })
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ suggestions: [], source: "none" as const })
  }

  const keywordFallback = suggestLeafCategoriesFromTitle(title, leafPaths, 6)
  const catalogLeaves = leafPathsForAiCatalog(leafPaths, title, description)

  const allowed = new Map<string, LeafPath>()
  const lines: string[] = []
  for (const lp of catalogLeaves) {
    allowed.set(lp.leafId, lp)
    lines.push(`${lp.leafId}\t${lp.breadcrumb}`)
  }

  const catalogBlock = lines.join("\n")

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an Affisell marketplace merchandiser. Map the listing to exactly 3 leaf categories from the ALLOWED list only (each line: CATEGORY_ID<TAB>breadcrumb).

Rules:
- Infer the primary product type from the full title (e.g. a "MacBook Air" or "iPad Air" is a laptop/tablet computer, not air fryers, air fresheners, or unrelated "air" products).
- Do not let a single generic substring (air, pro, mini, max, note) override the main noun (laptop, phone, headphones, lamp, etc.).
- Prefer the closest real leaf: computers and similar go under Computers / Laptops / PCs when present, not kitchen or fragrance.
- If DESCRIPTION is provided, use it together with the title.

Return JSON: {"ids":["id1","id2","id3"]} — only IDs from the list, no invented IDs, no duplicates, best match first.`,
        },
        {
          role: "user",
          content: `TITLE: ${title}\n${description ? `DESCRIPTION: ${description}\n` : ""}\nALLOWED (id<TAB>breadcrumb):\n${catalogBlock}`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? "{}"
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

    const merged = mergeSuggestionsByTitleRelevance(title, description, picked, keywordFallback, 3)
    const source =
      picked.length >= 2 && merged.every((lp, i) => picked[i]?.leafId === lp.leafId)
        ? ("ai" as const)
        : picked.length > 0
          ? ("hybrid" as const)
          : ("keyword" as const)
    return NextResponse.json({ suggestions: merged, source })
  } catch (e) {
    console.error("[suggest-categories-ai]", e)
    return NextResponse.json({ suggestions: keywordFallback, source: "keyword" as const })
  }
}
