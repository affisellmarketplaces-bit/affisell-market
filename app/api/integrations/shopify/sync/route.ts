import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSupplierProviderByPlatform } from "@/lib/supplier-sync/registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { supplierId?: string }
  try {
    body = (await req.json()) as { supplierId?: string }
  } catch {
    body = {}
  }

  const supplierId = body.supplierId?.trim() || session.user.id
  if (supplierId !== session.user.id) {
    return NextResponse.json({ error: "supplierId mismatch" }, { status: 403 })
  }

  const integration = await prisma.supplierIntegration.findFirst({
    where: {
      userId: supplierId,
      platform: "shopify",
      enabled: true,
    },
    orderBy: { updatedAt: "desc" },
  })

  if (!integration) {
    return NextResponse.json({ error: "Shopify integration not found" }, { status: 404 })
  }

  const provider = getSupplierProviderByPlatform("shopify")
  if (!provider) {
    return NextResponse.json({ error: "Shopify provider unavailable" }, { status: 503 })
  }

  try {
    const summary = await provider.fullSync(integration)
    const syncedCount = summary.created + summary.updated + summary.unpublished
    return NextResponse.json({ ok: true, syncedCount, summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed"
    console.error("[integrations/shopify/sync]", {
      supplierId,
      integrationId: integration.id,
      result: "error",
      error: msg,
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
