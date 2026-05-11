import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [balanceRow, entries] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { buyerRewardBalanceCents: true },
    }),
    prisma.buyerRewardLedger.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        amountCents: true,
        stripeSessionId: true,
        orderId: true,
        createdAt: true,
      },
    }),
  ])

  return NextResponse.json({
    balanceCents: balanceRow?.buyerRewardBalanceCents ?? 0,
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      amountCents: e.amountCents,
      stripeSessionId: e.stripeSessionId,
      orderId: e.orderId,
      createdAt: e.createdAt.toISOString(),
    })),
  })
}
