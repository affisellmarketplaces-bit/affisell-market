import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import {
  incrementPresetAbViews,
  type PresetAbVariant,
} from "@/lib/storefront-preset-ab-shared"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseVariant(raw: unknown): PresetAbVariant | null {
  return raw === "control" || raw === "challenger" ? raw : null
}

export async function POST(req: NextRequest) {
  let slug = ""
  let variant: PresetAbVariant | null = null
  try {
    const body = (await req.json()) as { slug?: string; variant?: string }
    slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : ""
    variant = parseVariant(body.variant)
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!slug || !variant) {
    return NextResponse.json({ error: "slug and variant required" }, { status: 400 })
  }

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, storefrontTheme: true },
  })
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  const theme = parseStorefrontTheme(store.storefrontTheme)
  const presetAb = theme.brandOps?.presetAb
  if (!presetAb?.enabled) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const nextAb = incrementPresetAbViews(presetAb, variant)
  const nextTheme = {
    ...(typeof store.storefrontTheme === "object" && store.storefrontTheme !== null
      ? (store.storefrontTheme as Record<string, unknown>)
      : {}),
    brandOps: mergeStorefrontBrandOps(theme.brandOps, { presetAb: nextAb }),
  }

  await prisma.store.update({
    where: { id: store.id },
    data: { storefrontTheme: nextTheme },
  })

  console.log("[preset-ab-impression]", { slug, variant, result: "ok" })
  return NextResponse.json({ ok: true })
}
