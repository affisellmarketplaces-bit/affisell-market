import { groqChatText, GROQ_TEXT_MODEL } from "@/lib/ai/groq-client"
import type { StorefrontFaqItem } from "@/lib/storefront-static-pages-shared"
import { prisma } from "@/lib/prisma"

export type MerchantOrderFaqSignals = {
  orderCount30d: number
  shippedCount30d: number
  deliveredCount30d: number
  pendingCount30d: number
  returnRequestCount30d: number
  avgFulfillmentDays: number | null
}

const COUNTABLE_STATUSES = ["paid", "preparing", "shipped", "refunded"] as const

export async function loadMerchantOrderFaqSignals(args: {
  userId: string
  role: "AFFILIATE" | "SUPPLIER"
}): Promise<MerchantOrderFaqSignals> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const where =
    args.role === "AFFILIATE"
      ? { affiliateId: args.userId, createdAt: { gte: since } }
      : { supplierId: args.userId, createdAt: { gte: since } }

  const orders = await prisma.order.findMany({
    where: {
      ...where,
      status: { in: [...COUNTABLE_STATUSES] },
    },
    select: {
      status: true,
      createdAt: true,
      shippedAt: true,
      deliveredAt: true,
    },
    take: 200,
    orderBy: { createdAt: "desc" },
  })

  let shippedCount30d = 0
  let deliveredCount30d = 0
  let pendingCount30d = 0
  const fulfillmentDays: number[] = []

  for (const o of orders) {
    if (o.deliveredAt) deliveredCount30d += 1
    if (o.shippedAt || o.deliveredAt) shippedCount30d += 1
    if (o.status === "paid" || o.status === "preparing") pendingCount30d += 1
    if (o.shippedAt) {
      const days = (o.shippedAt.getTime() - o.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      if (days >= 0 && days < 60) fulfillmentDays.push(days)
    }
  }

  const returnRequestCount30d = await prisma.orderReturn.count({
    where: {
      ...(args.role === "AFFILIATE"
        ? { order: { affiliateId: args.userId } }
        : { order: { supplierId: args.userId } }),
      createdAt: { gte: since },
    },
  })

  const avgFulfillmentDays =
    fulfillmentDays.length > 0
      ? Math.round(
          (fulfillmentDays.reduce((sum, d) => sum + d, 0) / fulfillmentDays.length) * 10
        ) / 10
      : null

  return {
    orderCount30d: orders.length,
    shippedCount30d,
    deliveredCount30d,
    pendingCount30d,
    returnRequestCount30d,
    avgFulfillmentDays,
  }
}

function clamp(raw: unknown, max: number): string {
  if (typeof raw !== "string") return ""
  return raw.trim().slice(0, max)
}

export function parseGeneratedBrandFaqItems(raw: string): StorefrontFaqItem[] | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const itemsRaw = o.faqItems ?? o.items
    if (!Array.isArray(itemsRaw)) return null
    const out: StorefrontFaqItem[] = []
    for (const row of itemsRaw) {
      if (!row || typeof row !== "object") continue
      const item = row as Record<string, unknown>
      const question = clamp(item.question, 600)
      const answer = clamp(item.answer, 600)
      if (!question || !answer) continue
      out.push({ question, answer })
      if (out.length >= 6) break
    }
    return out.length >= 2 ? out : null
  } catch {
    return null
  }
}

export async function generateStoreBrandFaqFromOrders(args: {
  storeName: string
  role: "AFFILIATE" | "SUPPLIER"
  locale?: string
  signals: MerchantOrderFaqSignals
}): Promise<StorefrontFaqItem[] | null> {
  if (!process.env.GROQ_API_KEY?.trim()) return null

  const locale = args.locale === "fr" ? "fr" : "en"
  const storeName = args.storeName.trim().slice(0, 80) || "My Store"

  const raw = await groqChatText({
    model: GROQ_TEXT_MODEL,
    temperature: 0.35,
    max_tokens: 900,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Write FAQ items for an ecommerce storefront based on real order signals. Return JSON: { faqItems: [{ question, answer }] }. " +
          "EU-friendly, no false delivery promises. If orderCount is 0, write generic EU shipping/returns FAQ.",
      },
      {
        role: "user",
        content: JSON.stringify({
          storeName,
          role: args.role,
          locale,
          signals: args.signals,
          rules: { minItems: 3, maxItems: 5, maxAnswerChars: 400 },
        }),
      },
    ],
  })

  if (!raw) return null
  return parseGeneratedBrandFaqItems(raw)
}
