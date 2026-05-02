import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizePid(p: unknown): string | null {
  if (typeof p !== "string" || !p.trim()) return null
  return p.trim().toLowerCase()
}

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const accounts = await prisma.account.findMany({
    where: { userId },
    select: {
      provider: true,
      providerAccountId: true,
      id: true,
      type: true,
      expires_at: true,
    },
  })

  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      providerAccountId: a.providerAccountId,
      type: a.type,
      expires_at: a.expires_at,
    })),
    hasPassword: !!userRow?.password?.length,
  })
}

export async function DELETE(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { provider?: unknown }
  const provider = normalizePid(body.provider)
  if (!provider) return NextResponse.json({ error: "provider required" }, { status: 400 })

  const count = await prisma.account.count({ where: { userId } })
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })
  const hasPassword = !!userRow?.password?.length
  if (!hasPassword && count <= 1) {
    return NextResponse.json(
      { error: "Add a password first so you keep a way to sign in." },
      { status: 400 },
    )
  }

  const del = await prisma.account.deleteMany({
    where: { userId, provider },
  })
  if (!del.count) {
    return NextResponse.json({ error: "Linked account not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
