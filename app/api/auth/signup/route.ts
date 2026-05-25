import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { claimAffiliateInvitationForUser } from "@/lib/supplier-affiliate-invitation"
import { claimSupplierInvitationForUser } from "@/lib/supplier-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { email, password, role, name: nameRaw, tiktok, siret, inviteToken } = (await req.json()) as {
      email?: string
      password?: string
      role?: string
      name?: string
      tiktok?: string
      siret?: string
      inviteToken?: string
    }
    const emailNormalized = typeof email === "string" ? email.toLowerCase().trim() : ""
    if (!emailNormalized || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { email: emailNormalized } })
    if (exists) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 10)
    const resolvedRole =
      role === "SUPPLIER" ? "SUPPLIER" : role === "CUSTOMER" ? "CUSTOMER" : "AFFILIATE"

    const displayName =
      typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim().slice(0, 120) : null

    const user = await prisma.user.create({
      data: {
        email: emailNormalized,
        password: hash,
        role: resolvedRole,
        name: displayName,
      },
    })

    let store = null
    if (resolvedRole === "AFFILIATE" || resolvedRole === "SUPPLIER") {
      store = await ensureMerchantStore({
        userId: user.id,
        email: emailNormalized,
        displayName,
      })
    }

    const tiktokHandle =
      typeof tiktok === "string" && tiktok.trim() ? tiktok.trim().replace(/^@/, "").slice(0, 80) : null
    const siretDigits =
      typeof siret === "string" && siret.trim() ? siret.replace(/\D/g, "").slice(0, 14) : null

    if (store && tiktokHandle && resolvedRole === "AFFILIATE") {
      await prisma.store.update({
        where: { id: store.id },
        data: { tiktok: tiktokHandle },
      })
    }

    if (store && siretDigits && resolvedRole === "SUPPLIER") {
      await prisma.store.update({
        where: { id: store.id },
        data: { description: `SIRET: ${siretDigits}` },
      })
    }

    if (resolvedRole === "SUPPLIER" && typeof inviteToken === "string" && inviteToken.trim()) {
      await claimSupplierInvitationForUser(inviteToken.trim(), user.id).catch((e) => {
        console.error("[signup] supplier invite claim failed", e)
      })
    }

    if (resolvedRole === "AFFILIATE" && typeof inviteToken === "string" && inviteToken.trim()) {
      await claimAffiliateInvitationForUser(inviteToken.trim(), user.id).catch((e) => {
        console.error("[signup] affiliate invite claim failed", e)
      })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: unknown) {
    console.error("[signup]", e)
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
