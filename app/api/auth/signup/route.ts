import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { email, password, role } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return NextResponse.json({ error: "Email déjà utilisé" }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: {
        email,
        password: hash,
        role: role === "FOURNISSEUR" ? "SUPPLIER" : "AFFILIATE",
      },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: any) {
    console.error("[signup]", e)
    return NextResponse.json(
      { error: e.message || "Erreur serveur" },
      { status: 500 }
    )
  }
}
