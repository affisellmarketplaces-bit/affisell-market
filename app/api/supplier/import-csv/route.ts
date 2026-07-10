import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { OnboardingSupplierDay1Email } from "@/emails/onboarding-supplier-day1"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { publicAbsoluteUrl } from "@/lib/public-app-url"
import { prisma } from "@/lib/prisma"
import {
  insertBulkParsedProduct,
} from "@/lib/supplier-bulk-import-commit"
import {
  mapSupplierCsvRows,
  mappingIsComplete,
  parseCsvText,
  rowsToObjects,
  suggestSupplierCsvMapping,
  SUPPLIER_CSV_MAX_ROWS,
  SUPPLIER_CSV_PREVIEW_COUNT,
  SUPPLIER_CSV_TEMPLATE_SAMPLE,
  toBulkProductRow,
  type SupplierCsvColumnMapping,
  type SupplierCsvRawRow,
} from "@/lib/supplier-csv-import"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

async function resolveCategoryIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const candidates = await prisma.category.findMany({
    where: { name: { contains: trimmed, mode: "insensitive" } },
    take: 20,
    select: { id: true, name: true },
  })
  if (candidates.length === 0) return null

  for (const c of candidates) {
    const childCount = await prisma.category.count({ where: { parentId: c.id } })
    if (childCount === 0) return c.id
  }
  return candidates[0]?.id ?? null
}

async function requireSupplier() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "SUPPLIER") {
    return null
  }
  return session.user.id
}

export async function GET(req: Request) {
  const supplierId = await requireSupplier()
  if (!supplierId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  if (searchParams.get("download") === "template") {
    return new NextResponse(SUPPLIER_CSV_TEMPLATE_SAMPLE, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="affisell-catalog-template.csv"',
        "Cache-Control": "no-store",
      },
    })
  }

  const affiliateCount = await prisma.user.count({ where: { role: "AFFILIATE" } })
  return NextResponse.json({
    templateUrl: "/api/supplier/import-csv?download=template",
    affiliateCount,
    maxRows: SUPPLIER_CSV_MAX_ROWS,
  })
}

async function sendFirstProductLiveEmail(userId: string): Promise<void> {
  const webhookId = `onboarding:supplier:day1:product_live:${userId}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id: webhookId } })
  if (existing) return

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  })
  if (!user?.email) return

  const store = await prisma.store.findUnique({
    where: { userId },
    select: { slug: true },
  })
  const browseUrl = publicAbsoluteUrl("/marketplace")
  const storefrontUrl = store?.slug
    ? publicAbsoluteUrl(`/shops/${store.slug}`)
    : browseUrl

  const display =
    user.name?.trim() || user.email.split("@")[0] || "partenaire"

  const sent = await sendResendReactEmail({
    context: "supplier-first-product-live",
    intendedTo: user.email,
    subject: "Ton 1er produit est live — voici comment les affiliés le voient",
    template: OnboardingSupplierDay1Email,
    props: {
      name: display,
      importUrl: publicAbsoluteUrl("/dashboard/supplier/onboarding"),
      templateUrl: browseUrl,
      affiliatePreviewUrl: storefrontUrl,
    },
  })

  if (sent.ok) {
    await prisma.processedWebhook.create({
      data: {
        id: webhookId,
        status: "success",
        error: sent.resendId ? `resend:${sent.resendId}` : null,
      },
    })
    console.log("[supplier-csv-import]", { userId, result: "first_product_email_sent" })
  }
}

export async function POST(req: Request) {
  const supplierId = await requireSupplier()
  if (!supplierId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ error: "invalid_form" }, { status: 400 })
    }

    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 })
    }

    const text = await file.text()
    const { headers, rows } = parseCsvText(text)
    if (headers.length === 0) {
      return NextResponse.json({ error: "empty_csv" }, { status: 400 })
    }

    const rawRows = rowsToObjects(headers, rows)
    const suggestedMapping = suggestSupplierCsvMapping(headers)

    console.log("[supplier-csv-import]", {
      supplierId,
      result: "parsed",
      rowCount: rawRows.length,
    })

    return NextResponse.json({
      success: true,
      headers,
      rows: rawRows.slice(0, SUPPLIER_CSV_MAX_ROWS),
      suggestedMapping,
      rowCount: rawRows.length,
    })
  }

  let body: {
    action?: string
    mapping?: SupplierCsvColumnMapping
    rows?: SupplierCsvRawRow[]
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const action = body.action ?? "preview"
  const mapping = body.mapping ?? {}
  const rawRows = Array.isArray(body.rows) ? body.rows : []

  if (!mappingIsComplete(mapping)) {
    return NextResponse.json({ error: "incomplete_mapping" }, { status: 400 })
  }
  if (rawRows.length === 0) {
    return NextResponse.json({ error: "no_rows" }, { status: 400 })
  }

  const mapped = mapSupplierCsvRows(rawRows, mapping)

  if (action === "preview") {
    const preview = mapped.slice(0, SUPPLIER_CSV_PREVIEW_COUNT)
    const valid = mapped.filter((r) => r.errors.length === 0).length
    const invalid = mapped.length - valid
    return NextResponse.json({
      success: true,
      preview,
      summary: { total: mapped.length, valid, invalid },
    })
  }

  if (action !== "publish") {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 })
  }

  const priorProductCount = await prisma.product.count({ where: { supplierId } })

  const created: Array<{ id: string; name: string }> = []
  const failed: Array<{ index: number; error: string }> = []

  for (const row of mapped) {
    if (row.errors.length > 0) {
      failed.push({ index: row.index, error: row.errors.join(",") })
      continue
    }

    const categoryId = await resolveCategoryIdByName(row.categoryName)
    if (!categoryId) {
      failed.push({ index: row.index, error: "category_not_found" })
      continue
    }

    try {
      const product = await insertBulkParsedProduct(supplierId, categoryId, toBulkProductRow(row))
      created.push(product)
    } catch (e) {
      failed.push({
        index: row.index,
        error: e instanceof Error ? e.message : "create_failed",
      })
    }
  }

  console.log("[supplier-csv-import]", {
    supplierId,
    result: "published",
    created: created.length,
    failed: failed.length,
  })

  if (priorProductCount === 0 && created.length > 0) {
    void sendFirstProductLiveEmail(supplierId).catch((err: unknown) => {
      console.log("[supplier-csv-import]", {
        supplierId,
        result: "first_product_email_failed",
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  const affiliateCount = await prisma.user.count({ where: { role: "AFFILIATE" } })

  return NextResponse.json({
    success: true,
    created: created.length,
    failed: failed.length,
    products: created,
    failures: failed,
    affiliateCount,
  })
}
