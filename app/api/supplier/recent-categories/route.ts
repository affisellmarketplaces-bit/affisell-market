import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  parseRecentCategoriesJson,
  pushRecentCategory,
  type CategoryPathSegment,
  type RecentCategoryEntry,
} from "@/lib/category-browse"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { supplierRecentCategories: true },
  })
  const recent = parseRecentCategoriesJson(user?.supplierRecentCategories ?? [])
  return NextResponse.json({ recent })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    leafId?: unknown
    path?: unknown
  }
  const leafId = typeof body.leafId === "string" ? body.leafId.trim() : ""
  if (!leafId) {
    return NextResponse.json({ error: "Missing leafId" }, { status: 400 })
  }

  const pathRaw = body.path
  const path: CategoryPathSegment[] = []
  if (Array.isArray(pathRaw)) {
    for (const seg of pathRaw) {
      if (!seg || typeof seg !== "object") continue
      const s = seg as Record<string, unknown>
      const id = typeof s.id === "string" ? s.id.trim() : ""
      const name = typeof s.name === "string" ? s.name.trim() : ""
      if (id && name) path.push({ id, name })
    }
  }
  if (!path.length) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 })
  }

  const entry: RecentCategoryEntry = { leafId, path }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { supplierRecentCategories: true },
  })
  const prev = parseRecentCategoriesJson(user?.supplierRecentCategories ?? [])
  const next = pushRecentCategory(prev, entry, 5)

  await prisma.user.update({
    where: { id: session.user.id },
    data: { supplierRecentCategories: next },
  })

  return NextResponse.json({ recent: next })
}
