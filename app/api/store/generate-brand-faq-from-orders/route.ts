import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  generateStoreBrandFaqFromOrders,
  loadMerchantOrderFaqSignals,
} from "@/lib/storefront-brand-faq-orders.server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const store = await prisma.store.findUnique({
    where: { userId },
    select: { name: true },
  })
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  let locale: string | undefined
  try {
    const body = (await req.json()) as { locale?: string }
    locale = body.locale
  } catch {
    /* empty body ok */
  }

  const merchantRole = role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE"
  const signals = await loadMerchantOrderFaqSignals({ userId, role: merchantRole })
  const faqItems = await generateStoreBrandFaqFromOrders({
    storeName: store.name,
    role: merchantRole,
    locale,
    signals,
  })

  if (!faqItems) {
    console.log("[generate-brand-faq-from-orders]", { userId, result: "unavailable" })
    return NextResponse.json(
      { error: "AI FAQ unavailable (GROQ_API_KEY missing or generation failed)" },
      { status: 503 }
    )
  }

  console.log("[generate-brand-faq-from-orders]", {
    userId,
    orderCount30d: signals.orderCount30d,
    result: "ok",
  })
  return NextResponse.json({ faqItems, signals })
}
