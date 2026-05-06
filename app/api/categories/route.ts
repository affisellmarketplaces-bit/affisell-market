import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      select: {
        id: true,
        name: true,
        icon: true,
        slug: true,
        order: true,
        subcategories: {
          select: { id: true, name: true, slug: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { order: "asc" },
    })
    return NextResponse.json({ categories })
  } catch (e) {
    console.error("[api/categories]", e)
    return NextResponse.json({ categories: [] }, { status: 500 })
  }
}
