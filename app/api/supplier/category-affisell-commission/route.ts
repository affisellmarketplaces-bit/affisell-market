import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { affisellCommissionRateBpsToPercent } from "@/lib/affisell-platform-commission"
import { resolveCategoryAffisellCommissionBps } from "@/lib/affisell-platform-commission.server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Effective Affisell platform fee for a taxonomy category (supplier product form). */
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
    select: { id: true, name: true, fullPath: true, affisellCommissionRateBps: true },
  })
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }

  const effectiveBps = await resolveCategoryAffisellCommissionBps(categoryId)

  return NextResponse.json({
    categoryId: category.id,
    categoryName: category.name,
    fullPath: category.fullPath,
    affisellCommissionRateBps: category.affisellCommissionRateBps,
    effectiveBps,
    effectivePercent: affisellCommissionRateBpsToPercent(effectiveBps),
  })
}
