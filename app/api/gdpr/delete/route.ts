import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { deleteMerchantUser } from "@/lib/delete-merchant-account"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { confirm?: string }
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: 'Envoyez { "confirm": "DELETE" } pour confirmer.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (user.role === "SUPPLIER" || user.role === "AFFILIATE") {
    const result = await deleteMerchantUser(session.user.id, user.role)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.code === "HAS_ORDERS" ? "Compte avec commandes — contactez le support." : "Suppression impossible." },
        { status: 409 }
      )
    }
    return NextResponse.json({ ok: true })
  }

  const openOrders = await prisma.order.count({
    where: {
      buyerUserId: session.user.id,
      status: { in: ["paid", "preparing", "shipped"] },
    },
  })
  if (openOrders > 0) {
    return NextResponse.json(
      { error: "Impossible de supprimer le compte : commandes en cours." },
      { status: 409 }
    )
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      email: `deleted+${session.user.id}@affisell.invalid`,
      name: null,
      image: null,
      password: null,
      cookieConsent: { erased: true, updatedAt: new Date().toISOString() },
    },
  })

  return NextResponse.json({ ok: true, anonymized: true })
}
