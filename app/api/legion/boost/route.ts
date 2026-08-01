import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import {
  BOOST_MARGIN_DEFAULT,
  BOOST_MARGIN_MAX,
  BOOST_MARGIN_MIN,
  boostEndsAt,
  clampBoostMarginRate,
  commissionRateToMarginDecimal,
} from "@/lib/legion/boost"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  product_id: z.string().trim().min(1).max(64),
  product_title: z.string().trim().max(200).optional(),
  boost_margin_rate: z.number().min(BOOST_MARGIN_MIN).max(BOOST_MARGIN_MAX).optional(),
  /** Dev / fallback only — ignored when session is present. */
  supplier_id: z.string().trim().min(1).max(64).optional(),
})

/**
 * POST /api/legion/boost
 * Supplier launches a 2h commission BOOST for one product (idempotent block if already active).
 */
export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "legion-boost",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 })
  }

  const session = await auth()
  const sessionUserId = session?.user?.id
  const sessionRole = (session?.user as { role?: string } | undefined)?.role

  let supplierId = sessionUserId ?? null
  if (sessionUserId) {
    if (sessionRole !== "SUPPLIER") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
    }
  } else if (parsed.data.supplier_id && process.env.NODE_ENV !== "production") {
    // Local curl / demo fallback — never accept body.supplier_id in production.
    supplierId = parsed.data.supplier_id
  } else {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  if (!supplierId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const productId = parsed.data.product_id
  const rate = clampBoostMarginRate(parsed.data.boost_margin_rate ?? BOOST_MARGIN_DEFAULT)

  const product = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: { id: true, name: true, commissionRate: true, isDraft: true },
  })
  if (!product) {
    return NextResponse.json({ ok: false, error: "product_not_found" }, { status: 404 })
  }
  if (product.isDraft) {
    return NextResponse.json({ ok: false, error: "product_draft" }, { status: 400 })
  }

  const existing = await prisma.legionBoost.findFirst({
    where: {
      productId,
      status: "active",
      endsAt: { gt: new Date() },
    },
    select: { id: true, endsAt: true, boostMarginRate: true },
  })
  if (existing) {
    console.log("[legion-boost]", {
      result: "already_active",
      productId,
      boostId: existing.id,
    })
    return NextResponse.json({
      ok: true,
      already: true,
      boost: {
        id: existing.id,
        ends_at: existing.endsAt.toISOString(),
        boost_margin_rate: Number(existing.boostMarginRate),
      },
    })
  }

  const armySize = await prisma.storeProfile.count({ where: { isActive: true } })
  const endsAt = boostEndsAt()
  const oldMargin = commissionRateToMarginDecimal(product.commissionRate)

  const created = await prisma.legionBoost.create({
    data: {
      supplierId,
      productId: product.id,
      productTitle: parsed.data.product_title?.trim() || product.name,
      oldMarginRate: oldMargin,
      boostMarginRate: rate,
      startsAt: new Date(),
      endsAt,
      status: "active",
      armyNotifiedCount: armySize,
    },
  })

  console.log("[legion-boost]", {
    result: "created",
    boostId: created.id,
    productId: product.id,
    supplierId,
    rate,
    armyNotified: armySize,
  })

  return NextResponse.json({
    ok: true,
    already: false,
    boost: {
      id: created.id,
      product_id: created.productId,
      product_title: created.productTitle,
      old_margin_rate: Number(created.oldMarginRate),
      boost_margin_rate: Number(created.boostMarginRate),
      starts_at: created.startsAt.toISOString(),
      ends_at: created.endsAt.toISOString(),
      status: created.status,
      army_notified_count: created.armyNotifiedCount,
    },
  })
}
