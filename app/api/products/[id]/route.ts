import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = (await request.json()) as { active?: boolean }

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { supplierId: true },
  })

  if (!existing) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
  }

  if (existing.supplierId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { active: Boolean(body.active) },
  })

  return NextResponse.json(updated)
}
