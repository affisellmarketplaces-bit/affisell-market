import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  type AccountDeletionConfirmPayload,
  isAccountDeletionConfirmed,
} from "@/lib/account-deletion-shared"
import { deleteMerchantUser } from "@/lib/delete-merchant-account"
import { prisma } from "@/lib/prisma"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })
  if (!user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const body = (await req.json().catch(() => ({}))) as AccountDeletionConfirmPayload
  if (!isAccountDeletionConfirmed(body, user.email)) {
    return NextResponse.json(
      { error: "Type your account email to confirm permanent deletion." },
      { status: 400 }
    )
  }

  if (user.role === "SUPPLIER" || user.role === "AFFILIATE") {
    const result = await deleteMerchantUser(session.user.id, user.role)
    if (!result.ok) {
      console.log("[account-delete]", {
        userId: session.user.id,
        role: user.role,
        result: "blocked",
        code: result.code,
      })
      return NextResponse.json(
        {
          error:
            result.code === "HAS_ORDERS"
              ? "This account has marketplace orders and cannot be deleted automatically. Contact support."
              : "Account could not be deleted.",
          code: result.code,
        },
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
    console.log("[account-delete]", {
      userId: session.user.id,
      role: user.role,
      result: "blocked",
      code: "OPEN_BUYER_ORDERS",
    })
    return NextResponse.json(
      { error: "Cannot delete account while orders are in progress.", code: "OPEN_BUYER_ORDERS" },
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

  console.log("[account-delete]", { userId: session.user.id, role: user.role, result: "anonymized" })
  return NextResponse.json({ ok: true, anonymized: true })
}
