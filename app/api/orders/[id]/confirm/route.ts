import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      confirmedAt: true,
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Acheteur : `userId` côté Prisma (spec « buyerId » = id utilisateur acheteur).
  if (order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (order.confirmedAt) {
    return NextResponse.json(
      { error: "Order already confirmed" },
      { status: 400 }
    )
  }

  const now = new Date()
  const newDeliverableAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  )

  await prisma.order.update({
    where: { id: order.id },
    data: {
      confirmedAt: now,
      deliverableAt: newDeliverableAt,
    },
  })

  return NextResponse.json({ success: true, newDeliverableAt })
}
