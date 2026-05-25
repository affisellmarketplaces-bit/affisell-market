import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { removeAffiliateListingsFromStorefront } from "@/lib/affiliate-listing-remove"
import { affiliateListingsWhere } from "@/lib/merchant-tenant-scope"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    ids?: unknown
    isFeatured?: boolean
    isListed?: boolean
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200)
    : []

  if (!ids.length) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }

  if (typeof body.isFeatured !== "boolean" && typeof body.isListed !== "boolean") {
    return NextResponse.json({ error: "isFeatured or isListed required" }, { status: 400 })
  }

  const where = { id: { in: ids }, ...affiliateListingsWhere(session.user.id) }

  if (typeof body.isFeatured === "boolean") {
    await prisma.affiliateProduct.updateMany({
      where,
      data: { isFeatured: body.isFeatured },
    })
  }

  if (typeof body.isListed === "boolean") {
    await prisma.affiliateProduct.updateMany({
      where,
      data: { isListed: body.isListed },
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { ids?: unknown }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200)
    : []

  if (!ids.length) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }

  const result = await removeAffiliateListingsFromStorefront(session.user.id, ids)
  return NextResponse.json({ ok: true, ...result })
}
