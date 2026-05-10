import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { buildBulkImportTemplateBuffer, type BulkCategoryAttrDef } from "@/lib/supplier-bulk-excel"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function categoryBreadcrumb(leafId: string): Promise<string> {
  const segments: string[] = []
  let id: string | null = leafId
  const guard = new Set<string>()
  while (id && !guard.has(id)) {
    guard.add(id)
    const cur: { name: string; parentId: string | null } | null = await prisma.category.findUnique({
      where: { id },
      select: { name: true, parentId: true },
    })
    if (!cur) break
    segments.unshift(cur.name)
    id = cur.parentId
  }
  return segments.join(" > ") || "(category)"
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get("categoryId")?.trim() ?? ""
  if (!categoryId) {
    return NextResponse.json({ error: "categoryId query required" }, { status: 400 })
  }

  const exists = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  })
  if (!exists) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }

  const childCount = await prisma.category.count({ where: { parentId: categoryId } })
  if (childCount > 0) {
    return NextResponse.json(
      { error: "Choose a leaf category (no sub-categories under this node)." },
      { status: 400 }
    )
  }

  const rows = await prisma.categoryAttribute.findMany({
    where: { categoryId },
    orderBy: [{ order: "asc" }, { label: "asc" }],
    select: {
      key: true,
      label: true,
      type: true,
      unit: true,
      options: true,
      required: true,
    },
  })

  const attrDefs: BulkCategoryAttrDef[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    type: r.type,
    unit: r.unit,
    options: r.options ?? [],
    required: r.required,
  }))

  const categoryPath = await categoryBreadcrumb(categoryId)
  const buffer = await buildBulkImportTemplateBuffer({
    categoryId,
    categoryPath,
    attrDefs,
  })

  const safeName = `affisell-bulk-template.xlsx`
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  })
}
