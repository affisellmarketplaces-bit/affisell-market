import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { buildPresetAbWinnerThemeUpdate } from "@/lib/storefront-preset-ab-apply.server"
import { evaluatePresetAbWinner } from "@/lib/storefront-preset-ab-shared"
import { sendBrandPresetAbWinnerEmail } from "@/lib/emails/send-brand-preset-ab-winner"
import { mergeStorefrontThemeJson } from "@/lib/storefront-theme-json.server"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
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
    select: {
      id: true,
      name: true,
      storefrontTheme: true,
      user: { select: { email: true, name: true, role: true } },
    },
  })
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  const theme = parseStorefrontTheme(store.storefrontTheme)
  const presetAb = theme.brandOps?.presetAb
  if (!presetAb?.enabled) {
    return NextResponse.json({ error: "No running preset A/B experiment" }, { status: 400 })
  }
  if (presetAb.winnerAppliedAt) {
    return NextResponse.json({ error: "Winner already applied" }, { status: 409 })
  }

  const evaluation = evaluatePresetAbWinner(presetAb)
  if (!evaluation.winner) {
    return NextResponse.json({ error: "Winner not ready", reason: evaluation.reason }, { status: 400 })
  }

  const built = buildPresetAbWinnerThemeUpdate({
    storefrontTheme: store.storefrontTheme,
    presetAb,
    winner: evaluation.winner,
    reason: evaluation.reason,
  })
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 })
  }

  await prisma.store.update({
    where: { id: store.id },
    data: { storefrontTheme: built.nextStorefrontTheme },
  })

  const merchantRole = store.user.role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE"
  const brandStudioPath =
    merchantRole === "SUPPLIER" ? "/dashboard/supplier/storefront" : "/dashboard/affiliate/brand-studio"

  const emailResult = await sendBrandPresetAbWinnerEmail({
    email: store.user.email,
    name: store.user.name,
    storeName: store.name,
    winner: evaluation.winner,
    winnerReason: evaluation.reason,
    viewsControl: presetAb.viewsControl,
    viewsChallenger: presetAb.viewsChallenger,
    brandStudioPath,
  })

  if (emailResult.ok) {
    const appliedTheme = parseStorefrontTheme(built.nextStorefrontTheme)
    const appliedPresetAb = appliedTheme.brandOps?.presetAb
    if (appliedPresetAb) {
      const notifiedTheme = mergeStorefrontThemeJson(built.nextStorefrontTheme, {
        brandOps: mergeStorefrontBrandOps(appliedTheme.brandOps, {
          presetAb: {
            ...appliedPresetAb,
            winnerNotifiedAt: new Date().toISOString(),
          },
        }),
      })
      await prisma.store.update({
        where: { id: store.id },
        data: { storefrontTheme: notifiedTheme },
      })
    }
  }

  console.log("[preset-ab-apply-winner]", {
    storeId: store.id,
    winner: evaluation.winner,
    reason: evaluation.reason,
    emailSent: emailResult.ok,
    result: "applied",
  })

  return NextResponse.json({
    ok: true,
    winner: evaluation.winner,
    reason: evaluation.reason,
    emailSent: emailResult.ok,
  })
}
