import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { batchId } = await context.params
  const batch = await prisma.autoFulfillmentBatch.findUnique({
    where: { id: batchId },
    include: {
      supplierJobs: {
        include: {
          provider: { select: { name: true, channelType: true, slug: true } },
          lines: { select: { orderId: true, quantity: true, unitCostCents: true } },
        },
      },
      marketplaceOrders: {
        select: {
          id: true,
          fulfillmentStatus: true,
          product: { select: { name: true } },
        },
      },
    },
  })

  if (!batch) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ batch })
}
