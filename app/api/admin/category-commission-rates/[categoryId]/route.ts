import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import {
  affisellCommissionPercentToBps,
  clampAffisellCommissionRateBps,
} from "@/lib/affisell-platform-commission"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  /** Platform fee percent (e.g. 10 = 10%). */
  commissionPercent: z.number().min(0).max(50).optional(),
  commissionRateBps: z.number().int().min(0).max(5000).optional(),
  /** When true, clears category rate so parent/default applies. */
  inherit: z.boolean().optional(),
})

type Ctx = { params: Promise<{ categoryId: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { categoryId } = await ctx.params
  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const exists = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  })
  if (!exists) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }

  let affisellCommissionRateBps: number | null
  if (parsed.data.inherit) {
    affisellCommissionRateBps = null
  } else if (parsed.data.commissionRateBps != null) {
    affisellCommissionRateBps = clampAffisellCommissionRateBps(parsed.data.commissionRateBps)
  } else if (parsed.data.commissionPercent != null) {
    affisellCommissionRateBps = affisellCommissionPercentToBps(parsed.data.commissionPercent)
  } else {
    return NextResponse.json({ error: "Provide commissionPercent, commissionRateBps, or inherit" }, { status: 400 })
  }

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data: { affisellCommissionRateBps },
    select: {
      id: true,
      name: true,
      fullPath: true,
      affisellCommissionRateBps: true,
    },
  })

  return NextResponse.json({ ok: true, category: updated })
}
