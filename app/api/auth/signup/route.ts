import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { ensureMerchantStore } from "@/lib/ensure-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { email, password, role, name: nameRaw } = (await req.json()) as {
      email?: string
      password?: string
      role?: string
      name?: string
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

    if (resolvedRole === "AFFILIATE" || resolvedRole === "SUPPLIER") {
      await ensureMerchantStore({
        userId: user.id,
        email: emailNormalized,
        displayName,
      })
    }
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: unknown) {
    console.error("[signup]", e)
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
