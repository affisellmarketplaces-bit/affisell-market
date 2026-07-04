import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { generateStoreBrandStaticPages } from "@/lib/storefront-brand-static-pages.server"
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
    select: { name: true, description: true },
  })
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  let niche: string | undefined
  let locale: string | undefined
  try {
    const body = (await req.json()) as { niche?: string; locale?: string }
    niche = body.niche
    locale = body.locale
  } catch {
    /* empty body ok */
  }

  const pages = await generateStoreBrandStaticPages({
    storeName: store.name,
    description: store.description ?? undefined,
    niche,
    locale,
    role: role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE",
  })

  if (!pages) {
    console.log("[generate-brand-static-pages]", { userId, result: "unavailable" })
    return NextResponse.json(
      { error: "AI static pages unavailable (GROQ_API_KEY missing or generation failed)" },
      { status: 503 }
    )
  }

  console.log("[generate-brand-static-pages]", { userId, result: "ok", role })
  return NextResponse.json({ pages })
}
