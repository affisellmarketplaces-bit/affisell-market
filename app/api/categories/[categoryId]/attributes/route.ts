import { NextResponse } from "next/server"

import { resolveCategoryAttributesForFormV2 } from "@/lib/category-attribute-catalog"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params
  try {
    const attributes = await resolveCategoryAttributesForFormV2(categoryId)
    return NextResponse.json({ attributes, schemaVersion: 2 })
  } catch {
    return NextResponse.json({ attributes: [] })
  }
}
