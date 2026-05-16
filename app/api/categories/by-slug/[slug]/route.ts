import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

/** Resolve a leaf category by exact slug or Google taxonomy prefix (e.g. `hauts` → `hauts-212`). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw).trim().toLowerCase()
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 })
  }

  const cat = await prisma.category.findFirst({
    where: {
      isLeaf: true,
      OR: [{ slug: { equals: slug, mode: "insensitive" } }, { slug: { startsWith: `${slug}-`, mode: "insensitive" } }],
    },
    orderBy: { slug: "asc" },
    select: { id: true, name: true, slug: true },
  })

  if (!cat) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }

  return NextResponse.json(cat)
}
