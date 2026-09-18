import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  BULK_MAX_ROWS_PARSE,
  type BulkCategoryAttrDef,
  parseBulkImportWorkbookBuffer,
} from "@/lib/supplier-bulk-excel"
import { prisma } from "@/lib/prisma"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"
import { tMessage } from "@/lib/i18n-pick-message"

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

  const locale = await resolveRequestLocale(undefined)
  const V = "supplier.bulkExcelValidation"

  const name = (file as File).name?.toLowerCase() ?? ""
  if (!name.endsWith(".xlsx")) {
    return NextResponse.json({ error: tMessage(locale, `${V}.uploadXlsxOnly`) }, { status: 400 })
  }

  const ab = await (file as File).arrayBuffer()
  if (ab.byteLength > 6 * 1024 * 1024) {
    return NextResponse.json({ error: tMessage(locale, `${V}.fileTooLarge`) }, { status: 400 })
  }

  let results: Awaited<ReturnType<typeof parseBulkImportWorkbookBuffer>>
  try {
    results = await parseBulkImportWorkbookBuffer(ab, attrDefs, locale)
  } catch {
    return NextResponse.json({ error: tMessage(locale, `${V}.couldNotReadExcel`) }, { status: 400 })
  }

  if (results.length === 0) {
    return NextResponse.json(
      { error: tMessage(locale, `${V}.noDataRowsFound`) },
      { status: 400 }
    )
  }

  if (results.length > BULK_MAX_ROWS_PARSE) {
    return NextResponse.json(
      { error: tMessage(locale, `${V}.tooManyRows`).replace("{max}", String(BULK_MAX_ROWS_PARSE)) },
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
