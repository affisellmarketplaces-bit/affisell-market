import { NextResponse } from "next/server"

import { auth } from "@/auth"
import type { BulkCategoryAttrDef, ParsedBulkProductRow } from "@/lib/supplier-bulk-excel"
import {
  assertParsedBulkProductRow,
  insertBulkParsedProduct,
} from "@/lib/supplier-bulk-import-commit"
import { BULK_MAX_ROWS_COMMIT } from "@/lib/supplier-bulk-excel"
import { prisma } from "@/lib/prisma"
import { parseListingKind } from "@/lib/supplier-commission"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function attrsSatisfyDefs(row: ParsedBulkProductRow, defs: BulkCategoryAttrDef[]): string | null {
  const byKey = new Map(row.productAttributes.map((a) => [a.key, a.value.trim()]))
  for (const d of defs) {
    if (!d.required) continue
    const v = byKey.get(d.key) ?? ""
    if (!v) return `Missing required characteristic: ${d.label}`
    if (d.type?.toUpperCase() === "SELECT" && d.options.length > 0) {
      const ok = d.options.some((o) => o.toLowerCase() === v.toLowerCase())
      if (!ok) return `Invalid option for ${d.label}`
    }
  }
  return null
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { categoryId?: unknown; rows?: unknown; skipInvalid?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : ""
  const skipInvalid = body.skipInvalid === true
  if (!categoryId) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 })
  }

  const rowsRaw = body.rows
  if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) {
    return NextResponse.json({ error: "rows array required" }, { status: 400 })
  }
  if (rowsRaw.length > BULK_MAX_ROWS_COMMIT) {
    return NextResponse.json(
      { error: `At most ${BULK_MAX_ROWS_COMMIT} rows per commit` },
      { status: 400 }
    )
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
  const defs: BulkCategoryAttrDef[] = attrRows.map((r) => ({
    key: r.key,
    label: r.label,
    type: r.type,
    unit: r.unit,
    options: r.options ?? [],
    required: r.required,
  }))

  const supplierId = session.user.id
  const parsedRows: ParsedBulkProductRow[] = []

  for (const item of rowsRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const name = typeof o.name === "string" ? o.name : ""
    const description = typeof o.description === "string" ? o.description : "—"
    const priceEur = Number(o.priceEur ?? o.priceUsd)
    const rawCompare = o.compareAtEur ?? o.compareAtUsd
    const compareAtEur =
      rawCompare != null && rawCompare !== "" ? Number(rawCompare) : null
    const stock = Math.max(0, Math.round(Number(o.stock) || 0))
    const commissionPct = Math.round(Number(o.commissionPct) || 15)
    const listingKind = parseListingKind(o.listingKind)
    const images = Array.isArray(o.images)
      ? o.images.filter((x): x is string => typeof x === "string" && x.startsWith("http"))
      : []
    const shippingBody =
      o.shippingBody && typeof o.shippingBody === "object" && !Array.isArray(o.shippingBody)
        ? (o.shippingBody as Record<string, unknown>)
        : {}
    const paRaw = o.productAttributes
    const productAttributes: Array<{ key: string; label: string; value: string }> = []
    if (Array.isArray(paRaw)) {
      for (const row of paRaw) {
        if (!row || typeof row !== "object" || Array.isArray(row)) continue
        const r = row as Record<string, unknown>
        const key = String(r.key ?? "").trim()
        const label = String(r.label ?? key).trim()
        const value = String(r.value ?? "").trim()
        if (key && value) productAttributes.push({ key, label, value })
      }
    }

    parsedRows.push({
      name,
      description,
      priceEur,
      compareAtEur:
        compareAtEur != null && Number.isFinite(compareAtEur) && compareAtEur > 0
          ? compareAtEur
          : null,
      stock,
      commissionPct,
      listingKind,
      images,
      shippingBody,
      productAttributes,
    })
  }

  const created: Array<{ id: string; name: string }> = []
  const failed: Array<{ index: number; error: string }> = []

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i]!
    const baseErr = assertParsedBulkProductRow(row)
    const attrErr = attrsSatisfyDefs(row, defs)
    const errMsg = baseErr ?? attrErr
    if (errMsg) {
      if (skipInvalid) {
        failed.push({ index: i, error: errMsg })
        continue
      }
      return NextResponse.json(
        { error: `Row ${i + 1}: ${errMsg}`, index: i },
        { status: 400 }
      )
    }

    try {
      const p = await insertBulkParsedProduct(supplierId, categoryId, row)
      created.push(p)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed"
      if (skipInvalid) {
        failed.push({ index: i, error: msg })
        continue
      }
      return NextResponse.json({ error: `Row ${i + 1}: ${msg}`, index: i }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    created: created.length,
    failed: failed.length,
    products: created,
    failures: failed,
  })
}
