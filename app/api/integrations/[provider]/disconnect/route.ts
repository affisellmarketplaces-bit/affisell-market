import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { syncOrchestrator } from "@/lib/integrations/orchestrator"
import { providerEnumFromSlug } from "@/lib/integrations/types"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ provider: string }> }

const bodySchema = z
  .object({
    integrationId: z.string().min(1),
  })
  .strict()

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { provider: providerSlug } = await ctx.params
  const providerEnum = providerEnumFromSlug(providerSlug)
  if (!providerEnum) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "integrationId required" }, { status: 400 })
  }

  const integration = await prisma.supplierIntegration.findFirst({
    where: {
      id: parsed.data.integrationId,
      userId: session.user.id,
      provider: providerEnum,
    },
  })

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 })
  }

  if (integration.status === "DISCONNECTED") {
    return NextResponse.json({ error: "Already disconnected" }, { status: 409 })
  }

  try {
    const result = await syncOrchestrator.decouple(integration.id, session.user.id)
    return NextResponse.json({
      ok: true,
      message:
        "Products remain active on Affisell. Inventory is frozen at the last sync — edit manually anytime.",
      ...result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Disconnect failed"
    console.error("[integration-decouple]", {
      provider: providerSlug,
      supplierId: session.user.id,
      integrationId: integration.id,
      result: "error",
      error: msg,
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
