import { NextResponse } from "next/server"
import OpenAI from "openai"

import { auth } from "@/auth"
import {
  buildCategoryBrowse,
  fetchAllCategoriesForBrowse,
  suggestLeafCategoriesFromTitle,
  type LeafPath,
} from "@/lib/category-browse"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_CATALOG_LINES = 120

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

  const keywordFallback = suggestLeafCategoriesFromTitle(title, leafPaths, 3)

  const allowed = new Map<string, LeafPath>()
  const lines: string[] = []
  for (const lp of leafPaths.slice(0, MAX_CATALOG_LINES)) {
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
          content: `You are an Affisell marketplace merchandiser. Pick exactly 3 best-matching leaf categories for a supplier listing from the ALLOWED list only.
Each line is: CATEGORY_ID<TAB>full breadcrumb path.
Return JSON: {"ids":["id1","id2","id3"]} — only IDs that appear in the list, no invented IDs, no duplicates, order best-first.`,
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

    if (picked.length >= 2) {
      return NextResponse.json({ suggestions: picked.slice(0, 3), source: "ai" as const })
    }
    const merged = [...picked]
    for (const lp of keywordFallback) {
      if (merged.length >= 3) break
      if (!seen.has(lp.leafId)) {
        seen.add(lp.leafId)
        merged.push(lp)
      }
    }
    return NextResponse.json({ suggestions: merged.slice(0, 3), source: "hybrid" as const })
  } catch (e) {
    console.error("[suggest-categories-ai]", e)
    return NextResponse.json({ suggestions: keywordFallback, source: "keyword" as const })
  }
}
