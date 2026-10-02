import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { suggestListingCategories } from "@/lib/supplier-suggest-listing"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** @deprecated Prefer POST /api/supplier/suggest-listing — kept for compatibility. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: unknown
    description?: unknown
  }
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const description = typeof body.description === "string" ? body.description.trim() : ""

  const { suggestions, source } = await suggestListingCategories(title, description, prisma)
  return NextResponse.json({ suggestions, source })
}
