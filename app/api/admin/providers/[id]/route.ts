import type { Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"

import { providerPatchSchema } from "@/lib/admin/providers/schemas"
import { toProviderListRow } from "@/lib/admin/providers/serialize"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function buildApiConfigPatch(
  existing: unknown,
  apiEndpoint?: string
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  if (apiEndpoint === undefined) return base
  const endpoint = apiEndpoint.trim()
  if (!endpoint) {
    delete base.apiEndpoint
    delete base.endpoint
    return base
  }
  base.apiEndpoint = endpoint
  return base
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id } = await ctx.params
  const row = await prisma.fulfillmentProvider.findUnique({ where: { id } })
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 })

  return NextResponse.json({ row: toProviderListRow(row) })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id } = await ctx.params
  const parsed = providerPatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.fulfillmentProvider.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { name, type, apiEndpoint, paymentMethod, status } = parsed.data
  const data: Prisma.FulfillmentProviderUpdateInput = {}
  if (name != null) data.name = name
  if (type != null) data.channelType = type
  if (paymentMethod != null) data.paymentMethod = paymentMethod
  if (status != null) data.status = status
  if (apiEndpoint !== undefined) {
    data.apiConfig = buildApiConfigPatch(existing.apiConfig, apiEndpoint) as Prisma.InputJsonValue
  }

  const updated = await prisma.fulfillmentProvider.update({
    where: { id },
    data,
  })

  return NextResponse.json({ row: toProviderListRow(updated) })
}
