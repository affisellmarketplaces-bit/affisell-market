import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z.object({
  lightningEnabled: z.boolean(),
})

type RouteParams = { params: Promise<{ userId: string }> }

/** Admin: activer / couper Lightning pour une boutique fournisseur (bypass score). */
export async function PATCH(req: Request, { params }: RouteParams) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { userId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }

  const supplier = await prisma.user.findFirst({
    where: { id: userId, role: "SUPPLIER" },
    select: { id: true, email: true, store: { select: { name: true } } },
  })
  if (!supplier) {
    return NextResponse.json({ error: "supplier_not_found" }, { status: 404 })
  }

  const enabling = parsed.data.lightningEnabled
  const profile = await prisma.supplierProfile.upsert({
    where: { userId },
    create: {
      userId,
      trustScore: 50,
      lightningEnabled: enabling,
      lightningAdminOverride: enabling,
    },
    update: {
      lightningEnabled: enabling,
      lightningAdminOverride: enabling,
    },
    select: {
      trustScore: true,
      lightningEnabled: true,
      lightningAdminOverride: true,
    },
  })

  console.log("[admin-lightning]", {
    supplierId: userId,
    supplierEmail: supplier.email,
    storeName: supplier.store?.name ?? null,
    lightningEnabled: profile.lightningEnabled,
    lightningAdminOverride: profile.lightningAdminOverride,
    adminId: gate.session.user.id,
    result: enabling ? "enabled" : "disabled",
  })

  return NextResponse.json({
    success: true,
    userId,
    trustScore: profile.trustScore,
    lightningEnabled: profile.lightningEnabled,
    lightningAdminOverride: profile.lightningAdminOverride,
  })
}
