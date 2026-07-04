import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  buildStoreBrandBannerPrompt,
  generateStoreBrandBannerImage,
} from "@/lib/storefront-brand-banner.server"
import { prisma } from "@/lib/prisma"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const store = await prisma.store.findUnique({ where: { userId } })
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  let niche: string | undefined
  try {
    const body = (await req.json()) as { niche?: string }
    niche = body.niche
  } catch {
    /* empty body ok */
  }

  const theme = parseStorefrontTheme(store.storefrontTheme)
  const prompt = buildStoreBrandBannerPrompt({
    storeName: store.name,
    description: store.description ?? undefined,
    primary: theme.primary ?? "#18181b",
    accent: theme.accent ?? "#8b5cf6",
    niche,
  })

  const imageBuf = await generateStoreBrandBannerImage(prompt)
  if (!imageBuf) {
    console.log("[generate-brand-banner]", { userId, result: "unavailable" })
    return NextResponse.json(
      { error: "AI banner unavailable (HF_TOKEN missing or generation failed)" },
      { status: 503 }
    )
  }

  try {
    const filename = `ai-banner-${userId}-${Date.now()}.png`
    const dir = path.join(process.cwd(), "public", "uploads")
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, filename), imageBuf)

    const bannerUrl = `/uploads/${filename}`
    console.log("[generate-brand-banner]", { userId, result: "ok", bannerUrl })
    return NextResponse.json({ bannerUrl })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Banner save failed"
    console.log("[generate-brand-banner]", { userId, result: "error", error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
