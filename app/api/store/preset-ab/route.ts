import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { findStorefrontThemePreset } from "@/lib/storefront-theme-presets"

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

  let enabled = false
  let challengerPresetId = ""
  try {
    const body = (await req.json()) as { enabled?: boolean; challengerPresetId?: string }
    enabled = body.enabled === true
    challengerPresetId = typeof body.challengerPresetId === "string" ? body.challengerPresetId.trim() : ""
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const theme = parseStorefrontTheme(store.storefrontTheme)
  const controlPresetId = theme.presetId ?? null

  if (enabled) {
    if (!challengerPresetId || !findStorefrontThemePreset(challengerPresetId)) {
      return NextResponse.json({ error: "Invalid challenger preset" }, { status: 400 })
    }
    if (controlPresetId && challengerPresetId === controlPresetId) {
      return NextResponse.json({ error: "Challenger must differ from current preset" }, { status: 400 })
    }
  }

  const existingAb = theme.brandOps?.presetAb
  const presetAb = enabled
    ? {
        enabled: true,
        challengerPresetId,
        startedAt:
          existingAb?.challengerPresetId === challengerPresetId && existingAb.enabled
            ? existingAb.startedAt
            : new Date().toISOString(),
        viewsControl:
          existingAb?.challengerPresetId === challengerPresetId ? existingAb.viewsControl : 0,
        viewsChallenger:
          existingAb?.challengerPresetId === challengerPresetId ? existingAb.viewsChallenger : 0,
      }
    : existingAb
      ? { ...existingAb, enabled: false }
      : undefined

  const nextTheme = {
    ...(typeof store.storefrontTheme === "object" && store.storefrontTheme !== null
      ? (store.storefrontTheme as Record<string, unknown>)
      : {}),
    brandOps: mergeStorefrontBrandOps(theme.brandOps, { presetAb }),
  }

  await prisma.store.update({
    where: { id: store.id },
    data: { storefrontTheme: nextTheme },
  })

  console.log("[preset-ab]", { userId, enabled, challengerPresetId, result: "saved" })
  return NextResponse.json({ ok: true, presetAb })
}
