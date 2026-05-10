import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  BULK_MAX_ROWS_PARSE,
  type BulkCategoryAttrDef,
  parseBulkImportWorkbookBuffer,
} from "@/lib/supplier-bulk-excel"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const categoryId = String(form.get("categoryId") ?? "").trim()
  const file = form.get("file")
  if (!categoryId) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 })
  }
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "file required" }, { status: 400 })
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
    return NextResponse.json({ error: "Leaf category required" }, { status: 400 })
  }

  const attrRows = await prisma.categoryAttribute.findMany({
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

  const attrDefs: BulkCategoryAttrDef[] = attrRows.map((r) => ({
    key: r.key,
    label: r.label,
    type: r.type,
    unit: r.unit,
    options: r.options ?? [],
    required: r.required,
  }))

  const name = (file as File).name?.toLowerCase() ?? ""
  if (!name.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Upload an .xlsx file" }, { status: 400 })
  }

  const ab = await (file as File).arrayBuffer()
  if (ab.byteLength > 6 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 6 MB)" }, { status: 400 })
  }

  let results: Awaited<ReturnType<typeof parseBulkImportWorkbookBuffer>>
  try {
    results = await parseBulkImportWorkbookBuffer(ab, attrDefs)
  } catch {
    return NextResponse.json({ error: "Could not read Excel file" }, { status: 400 })
  }

  if (results.length === 0) {
    return NextResponse.json(
      { error: "No data rows found. Use the template «Products» sheet from row 2." },
      { status: 400 }
    )
  }

  if (results.length > BULK_MAX_ROWS_PARSE) {
    return NextResponse.json(
      { error: `At most ${BULK_MAX_ROWS_PARSE} data rows per file` },
      { status: 400 }
    )
  }

  const validRows = results.filter((r) => r.data && r.errors.length === 0)
  const invalidRows = results.filter((r) => r.errors.length > 0)

  return NextResponse.json({
    categoryId,
    summary: {
      total: results.length,
      valid: validRows.length,
      invalid: invalidRows.length,
    },
    rows: results.map((r) => ({
      rowNumber: r.rowNumber,
      errors: r.errors,
      warnings: r.warnings,
      data: r.data,
    })),
  })
}
