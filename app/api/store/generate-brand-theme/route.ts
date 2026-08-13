import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { generateStoreBrandTheme } from "@/lib/storefront-brand-ai-theme.server"
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
  if (role !== "AFFILIATE" && role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const store = await prisma.store.findUnique({
    where: { userId },
    select: { name: true, slug: true },
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

  const theme = await generateStoreBrandTheme({
    userId,
    role,
    storeName: store.name,
    locale,
  })

  return NextResponse.json({
    theme,
    boutiquePath: `/boutique/${encodeURIComponent(store.slug)}`,
  })
}
