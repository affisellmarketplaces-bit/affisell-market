import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import {
  executeSupplierProductsImport,
  SUPPLIER_IMPORT_MAX_BATCH,
} from "@/lib/supplier-products-import-exec"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ integrationId: string }> }

function bearerToken(req: Request): string | null {
  const raw = req.headers.get("authorization") ?? ""
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim())
  return m?.[1]?.trim() ?? null
}

/** Compare secrets in a way that does not short-circuit on length alone. */
function secretMatches(expected: string, received: string): boolean {
  try {
    const a = Buffer.from(expected, "utf8")
    const b = Buffer.from(received, "utf8")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { integrationId } = await ctx.params

  const integration = await prisma.supplierIntegration.findUnique({
    where: { id: integrationId },
    select: {
      id: true,
      platform: true,
      enabled: true,
      userId: true,
      config: true,
    },
  })

  if (!integration || integration.platform !== "webhook") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!integration.enabled) {
    return NextResponse.json({ error: "Disabled" }, { status: 403 })
  }

  const cfg =
    integration.config &&
    typeof integration.config === "object" &&
    !Array.isArray(integration.config)
      ? (integration.config as Record<string, unknown>)
      : {}
  const secret =
    typeof cfg.webhookSecret === "string" ? cfg.webhookSecret.trim() : ""
  if (secret.length < 16) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 })
  }

  const token = bearerToken(req)
  if (!token || !secretMatches(secret, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  let productsRaw: unknown[] = []
  if (Array.isArray(body.products)) {
    productsRaw = body.products
  } else {
    productsRaw = [body]
  }

  if (productsRaw.length === 0) {
    return NextResponse.json({ error: "Empty payload" }, { status: 400 })
  }

  if (productsRaw.length > SUPPLIER_IMPORT_MAX_BATCH) {
    return NextResponse.json(
      { error: `At most ${SUPPLIER_IMPORT_MAX_BATCH} products per request` },
      { status: 400 }
    )
  }

  const ex = await executeSupplierProductsImport({
    supplierId: integration.userId,
    productsRaw,
    bodyDraft: true,
  })

  if (!ex.ok) {
    await prisma.supplierIntegration.update({
      where: { id: integration.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: ex.error,
      },
    })
    return NextResponse.json({ error: ex.error }, { status: ex.status })
  }

  await prisma.supplierIntegration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncError: null,
      lastSyncSummary: {
        inbound: true,
        created: ex.createdCount,
      } as object,
    },
  })

  return NextResponse.json({
    ok: true,
    count: ex.createdCount,
    productIds: ex.products.map((p) => p.id),
  })
}
