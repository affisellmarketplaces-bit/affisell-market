import { NextResponse } from "next/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import {
  createMarginLock,
  getActiveMarginLockForProduct,
  toMarginLockDto,
} from "@/lib/margin/margin-lock-service"
import { getMarginLockStatus } from "@/lib/margin/margin-lock-types"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const session = await requireAffiliateSession()
  const { id: productId } = await ctx.params
  if (!productId?.trim()) {
    return NextResponse.json({ error: "product_id_required" }, { status: 400 })
  }

  const lock = await getActiveMarginLockForProduct({
    productId,
    resellerId: session.user.id,
  })

  if (!lock) {
    return NextResponse.json({ lock: null, status: null })
  }

  const dto = toMarginLockDto(lock)
  return NextResponse.json({
    lock: dto,
    status: getMarginLockStatus(lock),
  })
}

export async function POST(req: Request, ctx: RouteCtx) {
  const session = await requireAffiliateSession()
  const { id: productId } = await ctx.params
  if (!productId?.trim()) {
    return NextResponse.json({ error: "product_id_required" }, { status: 400 })
  }

  let salePrice = 0
  try {
    const body = (await req.json()) as { salePrice?: number }
    salePrice = Number(body.salePrice)
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  try {
    const lock = await createMarginLock({
      productId,
      resellerId: session.user.id,
      salePrice,
    })
    return NextResponse.json({
      lock: toMarginLockDto(lock),
      status: getMarginLockStatus(lock),
    })
  } catch (err) {
    const code = err instanceof Error ? err.message : "lock_failed"
    const status =
      code === "product_not_found" ? 404 : code === "invalid_sale_price" ? 400 : 500
    console.error("[margin-lock-api]", { productId, code })
    return NextResponse.json({ error: code }, { status })
  }
}
