import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { generateStoreBrandCopy } from "@/lib/storefront-brand-copy.server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const store = await prisma.store.findUnique({ where: { userId }, select: { name: true } })
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

  const copy = await generateStoreBrandCopy({
    storeName: store.name,
    niche,
    locale,
  })

  if (!copy) {
    console.log("[generate-brand-copy]", { userId, result: "unavailable" })
    return NextResponse.json(
      { error: "AI copy unavailable (GROQ_API_KEY missing or generation failed)" },
      { status: 503 }
    )
  }

  console.log("[generate-brand-copy]", { userId, result: "ok", niche: niche ?? "auto" })
  return NextResponse.json({ copy })
}
