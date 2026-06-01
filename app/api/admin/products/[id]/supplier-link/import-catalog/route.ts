import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import {
  getAeCatalogImportDiagnostics,
  importAeCatalogForAdmin,
} from "@/lib/fulfillment/import-ae-catalog-admin"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"
import { prisma } from "@/lib/prisma"

const jsonSchema = z.object({
  aeUrl: z.string().min(4),
  html: z.string().min(80).optional(),
  aerData: z.unknown().optional(),
  aerJson: z.string().min(20).optional(),
})

const MAX_HTML_BYTES = 4_000_000

export async function GET() {
  return NextResponse.json({ diagnostics: getAeCatalogImportDiagnostics() })
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id: productId } = await ctx.params
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      productVariants: { select: { id: true, color: true, size: true } },
    },
  })
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 })
  }

  const contentType = req.headers.get("content-type") ?? ""
  let aeUrl: string
  let html: string | undefined
  let aerData: unknown
  let aerJson: string | undefined

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    aeUrl = String(form.get("aeUrl") ?? "").trim()
    const file = form.get("htmlFile")
    if (file instanceof File) {
      if (file.size > MAX_HTML_BYTES) {
        return NextResponse.json(
          { ok: false, error: "Fichier HTML trop volumineux (max 4 Mo)." },
          { status: 400 }
        )
      }
      html = await file.text()
    } else {
      const raw = form.get("html")
      if (typeof raw === "string" && raw.length > 80) html = raw
    }
  } else {
    const body = jsonSchema.parse(await req.json())
    aeUrl = body.aeUrl
    html = body.html
    aerData = body.aerData
    aerJson = body.aerJson
  }

  try {
    const payload = await importAeCatalogForAdmin(aeUrl, product.productVariants, {
      html,
      aerData,
      aerJson,
    })

    console.log("[admin-import-ae-catalog]", {
      productId,
      source: payload.source,
      skuCount: payload.resolved.aeSkus.length,
      suggestionCount: payload.suggestions.length,
    })

    return NextResponse.json({
      ok: true,
      diagnostics: getAeCatalogImportDiagnostics(),
      ...payload,
    })
  } catch (e) {
    const message =
      e instanceof AliExpressApiError ? e.message : e instanceof Error ? e.message : "import_failed"
    console.log("[admin-import-ae-catalog]", { productId, error: message })
    return NextResponse.json(
      {
        ok: false,
        error: message,
        diagnostics: getAeCatalogImportDiagnostics(),
      },
      { status: 400 }
    )
  }
}
