import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { PRODUCT_REQUEST_NOTIF } from "@/lib/product-request-notif-constants"
import { serializeProductRequest } from "@/lib/product-request-types"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CATEGORIES = new Set([
  "general",
  "baby",
  "auto",
  "fitness",
  "beauty",
  "tech",
  "home",
  "fashion",
])

type PostBody = {
  title?: unknown
  description?: unknown
  category?: unknown
  quantity?: unknown
  targetPrice?: unknown
  country?: unknown
  imageUrl?: unknown
}

function parseCategory(raw: unknown): string {
  const c = typeof raw === "string" ? raw.trim().toLowerCase() : "general"
  return CATEGORIES.has(c) ? c : "general"
}

/**
 * POST /api/requests — reseller creates a product demand.
 * GET /api/requests — open list (suppliers) or own list (resellers).
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "affiliate_role_required" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as PostBody
  const title = typeof body.title === "string" ? body.title.trim() : ""
  if (title.length < 2) {
    return NextResponse.json({ error: "title_required" }, { status: 400 })
  }

  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 4000) : null
  const category = parseCategory(body.category)
  const quantity =
    typeof body.quantity === "number" && Number.isFinite(body.quantity)
      ? Math.max(1, Math.min(100_000, Math.round(body.quantity)))
      : 100
  const targetPrice =
    typeof body.targetPrice === "number" && Number.isFinite(body.targetPrice) && body.targetPrice > 0
      ? body.targetPrice
      : null
  const country =
    typeof body.country === "string" && body.country.trim().length === 2
      ? body.country.trim().toUpperCase()
      : "FR"
  const imageUrl =
    typeof body.imageUrl === "string" && body.imageUrl.trim().startsWith("http")
      ? body.imageUrl.trim().slice(0, 2000)
      : null

  const email = session.user.email?.trim() || `${session.user.id}@affisell.local`

  const created = await prisma.productRequest.create({
    data: {
      resellerId: session.user.id,
      resellerEmail: email,
      title: title.slice(0, 200),
      description: description || null,
      category,
      quantity,
      targetPrice,
      country,
      imageUrl,
      status: "open",
      quotesCount: 0,
    },
    select: { id: true, title: true, country: true, category: true },
  })

  console.log("[NEW REQUEST]", {
    id: created.id,
    title: created.title,
    country: created.country,
    category: created.category,
    result: "Alert suppliers",
  })

  try {
    let suppliers = await prisma.user.findMany({
      where: {
        role: "SUPPLIER",
        products: {
          some: {
            active: true,
            categories: { has: category },
          },
        },
      },
      select: { id: true },
      take: 20,
      orderBy: { createdAt: "desc" },
    })

    if (suppliers.length === 0) {
      suppliers = await prisma.user.findMany({
        where: { role: "SUPPLIER", products: { some: { active: true } } },
        select: { id: true },
        take: 20,
        orderBy: { createdAt: "desc" },
      })
    }

    const uniqueIds = [...new Set(suppliers.map((s) => s.id))]
    if (uniqueIds.length > 0) {
      await prisma.notification.createMany({
        data: uniqueIds.map((userId) => ({
          userId,
          type: PRODUCT_REQUEST_NOTIF.NEW_REQUEST,
          message: `Nouvelle demande: ${created.title}`,
          imageUrl,
          orderId: created.id,
        })),
      })
      console.log("[api/requests]", {
        step: "notify_suppliers",
        count: uniqueIds.length,
        requestId: created.id,
      })
    }
  } catch (err) {
    console.warn("[api/requests]", {
      step: "notify_skipped",
      message: err instanceof Error ? err.message : "unknown",
    })
  }

  return NextResponse.json({ id: created.id })
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  const url = new URL(req.url)
  const status = (url.searchParams.get("status") ?? "open").trim().toLowerCase()
  const category = url.searchParams.get("category")?.trim().toLowerCase() ?? ""
  const filter = (url.searchParams.get("filter") ?? "").trim().toLowerCase()
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100)

  const role = session.user.role
  if (role !== "AFFILIATE" && role !== "SUPPLIER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const categoryFilter = category && CATEGORIES.has(category) ? category : undefined

  let statusFilter: string | undefined
  if (status === "all") statusFilter = undefined
  else if (status === "fulfilled" || status === "closed" || status === "open") statusFilter = status
  else statusFilter = "open"

  if (role === "AFFILIATE") {
    const rows = await prisma.productRequest.findMany({
      where: {
        resellerId: session.user.id,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return NextResponse.json({
      requests: rows.map(serializeProductRequest),
      count: rows.length,
    })
  }

  // SUPPLIER filters: open | fulfilled | mine (quoted by me)
  if (filter === "mine") {
    const rows = await prisma.productRequest.findMany({
      where: {
        quotes: { some: { supplierId: session.user.id } },
        ...(categoryFilter ? { category: categoryFilter } : {}),
      },
      include: {
        quotes: {
          where: { supplierId: session.user.id },
          select: { status: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return NextResponse.json({
      requests: rows.map((r) => ({
        ...serializeProductRequest(r),
        myQuoteStatus: r.quotes[0]?.status ?? null,
      })),
      count: rows.length,
    })
  }

  const rows = await prisma.productRequest.findMany({
    where: {
      status: statusFilter ?? "open",
      ...(categoryFilter ? { category: categoryFilter } : {}),
    },
    include: {
      quotes: {
        where: { supplierId: session.user.id },
        select: { status: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  console.log("[api/requests]", {
    userId: session.user.id,
    role,
    count: rows.length,
    status: statusFilter ?? "all",
    filter: filter || null,
  })

  return NextResponse.json({
    requests: rows.map((r) => ({
      ...serializeProductRequest(r),
      myQuoteStatus: r.quotes[0]?.status ?? null,
    })),
    count: rows.length,
  })
}
