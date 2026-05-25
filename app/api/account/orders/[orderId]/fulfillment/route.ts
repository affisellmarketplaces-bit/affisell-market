import { z } from "zod"

import { auth } from "@/auth"
import { mapFulfillmentThread } from "@/lib/orders/ship-fulfillment-shared"
import { postFulfillmentMessage, respondShipExtension } from "@/lib/orders/ship-extension-actions"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const messageSchema = z
  .object({ action: z.literal("message"), body: z.string().min(8).max(4000) })
  .strict()

const extensionSchema = z
  .object({
    action: z.enum(["accept_extension", "reject_extension"]),
    note: z.string().max(500).optional(),
  })
  .strict()

const postSchema = z.discriminatedUnion("action", [
  messageSchema,
  extensionSchema,
])

async function loadBuyerOrder(orderId: string, userId: string, email: string) {
  const normalized = email.trim().toLowerCase()
  return prisma.order.findFirst({
    where: {
      id: orderId,
      OR: [{ buyerUserId: userId }, { customerEmail: { equals: normalized, mode: "insensitive" } }],
    },
    select: {
      id: true,
      status: true,
      buyerUserId: true,
      shipDeadlineAt: true,
      paidAt: true,
      createdAt: true,
      trackingNumber: true,
    },
  })
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  const order = await loadBuyerOrder(orderId, session.user.id, session.user.email)
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
      isSupplier: false,
      isBuyer: true,
    }),
  })
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  const order = await loadBuyerOrder(orderId, session.user.id, session.user.email)
  if (!order) return Response.json({ error: "Not found" }, { status: 404 })

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
      authorRole: "BUYER",
      authorUserId: session.user.id,
      body: parsed.data.body,
    })
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 409 })
    }
  } else if (parsed.data.action === "accept_extension") {
    if (!order.buyerUserId) {
      return Response.json({ error: "account_required" }, { status: 409 })
    }
    const result = await respondShipExtension({
      orderId,
      buyerUserId: session.user.id,
      accept: true,
      buyerNote: parsed.data.note,
    })
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 409 })
    }
  } else {
    if (!order.buyerUserId) {
      return Response.json({ error: "account_required" }, { status: 409 })
    }
    const result = await respondShipExtension({
      orderId,
      buyerUserId: session.user.id,
      accept: false,
      buyerNote: parsed.data.note,
    })
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 409 })
    }
  }

  return GET(req, ctx)
}
