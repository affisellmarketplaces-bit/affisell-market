import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { syncShopifyIntegrationRecord } from "@/lib/shopify-catalog-sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params

  const integration = await prisma.supplierIntegration.findFirst({
    where: { id, userId: session.user.id, platform: "shopify", enabled: true },
    select: { id: true, userId: true, config: true },
  })

  if (!integration) {
    return NextResponse.json(
      { error: "Shopify integration not found or disabled" },
      { status: 404 }
    )
  }

  const out = await syncShopifyIntegrationRecord(integration, { bodyDraft: true })

  if (!out.ok) {
    return NextResponse.json(
      { error: out.error, summary: out.summary },
      { status: out.summary?.fetched ? 400 : 502 }
    )
  }

  return NextResponse.json({ ok: true, summary: out.summary })
}
