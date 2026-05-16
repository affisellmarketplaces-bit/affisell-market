import { NextResponse } from "next/server"

import { categoryAttributesToDto } from "@/lib/category-attribute-api"
import { resolveCategoryAttributesForForm } from "@/lib/category-attribute-resolution"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params
  try {
    const rows = await resolveCategoryAttributesForForm(categoryId)
    const attributes = categoryAttributesToDto(rows)
    return NextResponse.json({ attributes })
  } catch {
    return NextResponse.json({ attributes: [] })
  }
}
