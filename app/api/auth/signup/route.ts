import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { email, password, role } = (await req.json()) as {
      email?: string
      password?: string
      role?: string
    }
    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 10)
    const resolvedRole =
      role === "SUPPLIER" || role === "FOURNISSEUR" ? "SUPPLIER" : "AFFILIATE"

    await prisma.user.create({
      data: {
        email,
        password: hash,
        role: resolvedRole,
      },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: unknown) {
    console.error("[signup]", e)
    const message = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
