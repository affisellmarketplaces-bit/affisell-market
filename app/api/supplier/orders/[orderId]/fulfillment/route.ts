import { z } from "zod"

import { auth } from "@/auth"
import { mapFulfillmentThread } from "@/lib/orders/ship-fulfillment-shared"
import {
  postFulfillmentMessage,
  requestShipExtension,
} from "@/lib/orders/ship-extension-actions"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const messageSchema = z
  .object({ action: z.literal("message"), body: z.string().min(8).max(4000) })
  .strict()

const extensionSchema = z
  .object({
    action: z.literal("request_extension"),
    reason: z.string().min(20).max(3000),
    extraDays: z.number().int().min(3).max(14).optional(),
  })
  .strict()

const postSchema = z.discriminatedUnion("action", [messageSchema, extensionSchema])

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { orderId } = await ctx.params
  const order = await prisma.order.findFirst({
    where: { id: orderId, supplierId: session.user.id },
    select: {
      id: true,
      status: true,
      shipDeadlineAt: true,
      paidAt: true,
      createdAt: true,
      trackingNumber: true,
    },
  })
  if (!order) return Response.json({ error: "Not found" }, { status: 404 })

  const [messages, extensions] = await Promise.all([
    prisma.orderFulfillmentMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orderShipExtension.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return Response.json({
    thread: mapFulfillmentThread(order, messages, extensions, {
      isSupplier: true,
      isBuyer: false,
    }),
  })
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { orderId } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.action === "message") {
    const result = await postFulfillmentMessage({
      orderId,
      authorRole: "SUPPLIER",
      authorUserId: session.user.id,
      body: parsed.data.body,
    })
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.error === "forbidden" ? 403 : 409 })
    }
  } else {
    const result = await requestShipExtension({
      orderId,
      supplierUserId: session.user.id,
      reason: parsed.data.reason,
      extraDays: parsed.data.extraDays,
    })
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.error === "forbidden" ? 403 : 409 })
    }
  }

  return GET(req, ctx)
}
