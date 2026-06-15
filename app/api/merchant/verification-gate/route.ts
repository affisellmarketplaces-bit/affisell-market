import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** Supplier / affiliate publish gate for dashboard UX. */
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [gate, draftCount] = await Promise.all([
    merchantVerificationGate(userId),
    prisma.product.count({
      where: {
        supplierId: userId,
        isDraft: true,
        active: true,
      },
    }),
  ])

  console.log("[merchant-gate]", {
    userId,
    allowed: gate.allowed,
    status: gate.status,
    reason: gate.reason,
    draftCount,
  })

  return NextResponse.json({
    allowed: gate.allowed,
    status: gate.status,
    reason: gate.reason,
    draftCount,
  })
}
