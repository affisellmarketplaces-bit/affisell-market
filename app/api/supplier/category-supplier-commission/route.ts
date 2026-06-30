import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  applySupplierCommissionDynamics,
  isSupplierCommissionDynamicsEnabled,
  SUPPLIER_VOLUME_COMMISSION_TIERS,
} from "@/lib/commission-grid-dynamic"
import { prisma } from "@/lib/prisma"
import {
  DEFAULT_SUPPLIER_COMMISSION_BPS,
  supplierCommissionRateBpsToPercent,
} from "@/lib/supplier-commission-rate"
import { resolveCategorySupplierCommissionBps } from "@/lib/supplier-commission-rate.server"
import { loadSupplierTrailingGmvCents } from "@/lib/supplier-trailing-gmv.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Effective supplier → affiliate commission for a taxonomy category (supplier product form). */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const categoryId = new URL(req.url).searchParams.get("categoryId")?.trim() ?? ""
  if (!categoryId) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 })
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      name: true,
      fullPath: true,
      supplierCommissionRateBps: true,
    },
  })
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }

  const categoryBps =
    (await resolveCategorySupplierCommissionBps(categoryId)) ?? DEFAULT_SUPPLIER_COMMISSION_BPS

  const dynamicsEnabled = isSupplierCommissionDynamicsEnabled()
  const trailingGmvCents = dynamicsEnabled
    ? await loadSupplierTrailingGmvCents(session.user.id)
    : 0

  const dynamics = applySupplierCommissionDynamics({
    baseBps: categoryBps,
    trailingGmvCents,
  })

  return NextResponse.json({
    categoryId: category.id,
    categoryName: category.name,
    fullPath: category.fullPath,
    supplierCommissionRateBps: category.supplierCommissionRateBps,
    categoryBps,
    categoryPercent: supplierCommissionRateBpsToPercent(categoryBps),
    effectiveBps: dynamics.effectiveBps,
    effectivePercent: supplierCommissionRateBpsToPercent(dynamics.effectiveBps),
    dynamicsEnabled,
    volumeBonusBps: dynamics.volumeBonusBps,
    volumeTierLabel: dynamics.volumeTierLabel,
    trailingGmvCents: dynamics.trailingGmvCents,
    volumeTiers: SUPPLIER_VOLUME_COMMISSION_TIERS.map((tier) => ({
      label: tier.label,
      minGmvEur: tier.minGmvCents / 100,
      bonusPercent: tier.bonusBps / 100,
    })),
  })
}
