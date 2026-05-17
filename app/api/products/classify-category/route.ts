import { NextResponse } from "next/server"

import { CATEGORIES_AFFISELL } from "@/lib/ai/categories"
import { classifyAffisellProduct } from "@/lib/ai/classify-product"
import { buildCategoryBrowse, fetchAllCategoriesForBrowse } from "@/lib/category-browse"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ClassifyCategoryResponseJson = {
  suggestions: Array<{
    category: string
    confidence: number
    reason: string
    leafId: string | null
  }>
  error?: string
}

export async function POST(req: Request): Promise<NextResponse<ClassifyCategoryResponseJson>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ suggestions: [], error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ suggestions: [], error: "Expected JSON object" }, { status: 400 })
  }

  const o = body as Record<string, unknown>
  const title = typeof o.title === "string" ? o.title.trim() : ""
  const description = typeof o.description === "string" ? o.description.trim() : ""
  const imageUrl =
    typeof o.imageUrl === "string" && o.imageUrl.trim().length > 0 ? o.imageUrl.trim() : undefined

  if (title.length === 0) {
    return NextResponse.json({ suggestions: [], error: "title is required" }, { status: 400 })
  }

  try {
    const rows = await fetchAllCategoriesForBrowse(prisma)
    const { leafPaths } = buildCategoryBrowse(rows)
    const allowedBreadcrumbs =
      leafPaths.length > 0 ? leafPaths.map((lp) => lp.breadcrumb) : [...CATEGORIES_AFFISELL]

    const { suggestions, error } = await classifyAffisellProduct(
      { title, description, imageUrl },
      { allowedBreadcrumbs, leafPaths }
    )

    if (error) {
      return NextResponse.json({ suggestions, error }, { status: suggestions.length ? 200 : 503 })
    }

    return NextResponse.json({ suggestions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Classification failed"
    return NextResponse.json({ suggestions: [], error: msg }, { status: 500 })
  }
}
