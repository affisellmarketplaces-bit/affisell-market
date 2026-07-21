import { NextResponse } from "next/server"

import { auth } from "@/auth"
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
    const suppliers = await prisma.user.findMany({
      where: {
        role: "SUPPLIER",
        products: {
          some: {
            active: true,
            OR: [
              { categories: { has: category } },
              { categories: { hasSome: [category, created.title.slice(0, 24)] } },
            ],
          },
        },
      },
      select: { id: true },
      take: 25,
      orderBy: { createdAt: "desc" },
    })

    if (suppliers.length === 0) {
      const fallback = await prisma.user.findMany({
        where: { role: "SUPPLIER", products: { some: { active: true } } },
        select: { id: true },
        take: 15,
        orderBy: { createdAt: "desc" },
      })
      suppliers.push(...fallback)
    }

    const uniqueIds = [...new Set(suppliers.map((s) => s.id))]
    if (uniqueIds.length > 0) {
      await prisma.notification.createMany({
        data: uniqueIds.map((userId) => ({
          userId,
          type: "PRODUCT_REQUEST",
          message: `🔥 Demande reseller: ${created.title} (${created.country} · ${created.category})`,
          imageUrl: imageUrl,
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
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100)

  const role = session.user.role
  if (role !== "AFFILIATE" && role !== "SUPPLIER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const statusFilter =
    status === "all" ? undefined : status === "closed" ? "closed" : "open"
  const categoryFilter = category && CATEGORIES.has(category) ? category : undefined

  const rows = await prisma.productRequest.findMany({
    where:
      role === "AFFILIATE"
        ? {
            resellerId: session.user.id,
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(categoryFilter ? { category: categoryFilter } : {}),
          }
        : {
            status: statusFilter ?? "open",
            ...(categoryFilter ? { category: categoryFilter } : {}),
          },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  console.log("[api/requests]", {
    userId: session.user.id,
    role,
    count: rows.length,
    status: statusFilter ?? "all",
  })

  return NextResponse.json({ requests: rows, count: rows.length })
}
