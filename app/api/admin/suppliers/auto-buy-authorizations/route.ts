import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupplierChannelType } from "@prisma/client"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadAdminAutoBuyAuthorizations } from "@/lib/admin/suppliers/load-auto-buy-authorizations"
import { AUTO_BUY_SOURCING_CHANNELS } from "@/lib/auto-buy-sourcing-channels"
import { setSupplierAutoBuyAuthorization } from "@/lib/supplier-auto-buy-authorization.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const data = await loadAdminAutoBuyAuthorizations()
  return NextResponse.json(data)
}

const bodySchema = z.object({
  supplierId: z.string().min(1),
  channelType: z.enum(AUTO_BUY_SOURCING_CHANNELS as unknown as [SupplierChannelType, ...SupplierChannelType[]]),
  enabled: z.boolean(),
})

/** Admin grants/revokes one supplier's permission to auto-buy from one sourcing channel. */
export async function PATCH(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const result = await setSupplierAutoBuyAuthorization({
    supplierId: parsed.data.supplierId,
    channelType: parsed.data.channelType,
    enabled: parsed.data.enabled,
    adminUserId: gate.session.user.id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
