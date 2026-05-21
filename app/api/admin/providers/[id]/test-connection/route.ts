import type { Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"

import { mergeHealthMetadata } from "@/lib/admin/providers/metadata"
import { testFulfillmentProviderConnection } from "@/lib/admin/providers/test-connection"
import { toProviderListRow } from "@/lib/admin/providers/serialize"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id } = await ctx.params
  const provider = await prisma.fulfillmentProvider.findUnique({ where: { id } })
  if (!provider) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const result = await testFulfillmentProviderConnection(provider)
  const now = new Date().toISOString()

  const updated = await prisma.fulfillmentProvider.update({
    where: { id },
    data: {
      metadata: mergeHealthMetadata(provider.metadata, {
        healthStatus: result.ok ? "OK" : "ERROR",
        healthMessage: result.message,
        lastHealthCheckAt: now,
      }) as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({
    result,
    row: toProviderListRow(updated),
  })
}
