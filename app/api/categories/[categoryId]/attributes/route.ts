import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  _req: Request,
  context: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await context.params
    const id = typeof categoryId === "string" ? categoryId.trim() : ""
    if (!id) return NextResponse.json({ error: "Missing categoryId" }, { status: 400 })

    const attributes = await prisma.categoryAttribute.findMany({
      where: { categoryId: id },
      orderBy: [{ order: "asc" }, { label: "asc" }],
    })

    return NextResponse.json({ attributes })
  } catch (e) {
    console.error("[api/categories/:id/attributes]", e)
    return NextResponse.json({ error: "Failed to load attributes" }, { status: 500 })
  }
}

