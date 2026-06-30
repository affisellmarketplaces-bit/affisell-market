import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import {
  affisellCommissionPercentToBps,
  clampAffisellCommissionRateBps,
} from "@/lib/affisell-platform-commission"
import { prisma } from "@/lib/prisma"
import {
  clampSupplierCommissionRateBps,
  supplierCommissionPercentToBps,
} from "@/lib/supplier-commission-rate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  /** Affisell platform fee percent (e.g. 10 = 10%). */
  commissionPercent: z.number().min(0).max(50).optional(),
  commissionRateBps: z.number().int().min(0).max(5000).optional(),
  inherit: z.boolean().optional(),
  /** Supplier → affiliate commission percent (e.g. 15 = 15%). */
  supplierCommissionPercent: z.number().min(0).max(100).optional(),
  supplierCommissionRateBps: z.number().int().min(0).max(10_000).optional(),
  inheritSupplier: z.boolean().optional(),
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

  const data: {
    affisellCommissionRateBps?: number | null
    supplierCommissionRateBps?: number | null
  } = {}

  if (parsed.data.inherit) {
    data.affisellCommissionRateBps = null
  } else if (parsed.data.commissionRateBps != null) {
    data.affisellCommissionRateBps = clampAffisellCommissionRateBps(parsed.data.commissionRateBps)
  } else if (parsed.data.commissionPercent != null) {
    data.affisellCommissionRateBps = affisellCommissionPercentToBps(parsed.data.commissionPercent)
  }

  if (parsed.data.inheritSupplier) {
    data.supplierCommissionRateBps = null
  } else if (parsed.data.supplierCommissionRateBps != null) {
    data.supplierCommissionRateBps = clampSupplierCommissionRateBps(
      parsed.data.supplierCommissionRateBps
    )
  } else if (parsed.data.supplierCommissionPercent != null) {
    data.supplierCommissionRateBps = supplierCommissionPercentToBps(
      parsed.data.supplierCommissionPercent
    )
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      {
        error:
          "Provide commissionPercent/commissionRateBps/inherit and/or supplierCommissionPercent/supplierCommissionRateBps/inheritSupplier",
      },
      { status: 400 }
    )
  }

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data,
    select: {
      id: true,
      name: true,
      fullPath: true,
      affisellCommissionRateBps: true,
      supplierCommissionRateBps: true,
    },
  })

  return NextResponse.json({ ok: true, category: updated })
}
