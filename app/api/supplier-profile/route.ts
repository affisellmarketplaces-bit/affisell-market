import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { flushLogs, logger } from "@/lib/logger"
import { trackServer } from "@/lib/analytics"
import { scheduleSupplierWelcomeEmail } from "@/lib/emails/send-supplier-welcome"
import { upsertMerchantDefaults } from "@/lib/merchant-defaults"
import { prisma } from "@/lib/prisma"
import {
  getSupplierKindDisplaySlug,
  parseSupplierKind,
  SUPPLIER_KIND_SET_VALUES,
  type SupplierKind,
  type SupplierKindSetValue,
} from "@/lib/supplier-kind"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const postSchema = z.object({
  supplierKind: z
    .enum([...SUPPLIER_KIND_SET_VALUES, "grossiste"] as const)
    .transform((v): SupplierKindSetValue => (v === "grossiste" ? "stocker" : v)),
  nom_entreprise: z.string().trim().min(1).max(200).optional(),
  pays_stock: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((v) => v.toUpperCase())
    .optional(),
})

/**
 * POST /api/supplier-profile — set supplierKind (producer|stocker) for the session SUPPLIER.
 * Optional: nom_entreprise → User.name ; pays_stock → MerchantDefault.countryCode.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    await flushLogs()
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }
  if (session.user.role !== "SUPPLIER") {
    await flushLogs()
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    await flushLogs()
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    await flushLogs()
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const userId = session.user.id
  const nextKind = parsed.data.supplierKind

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { supplierKind: true, role: true },
  })
  if (!before || before.role !== "SUPPLIER") {
    await flushLogs()
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const prevKind = parseSupplierKind(before.supplierKind)
  const onboardingComplete = prevKind === "unset" && (nextKind === "producer" || nextKind === "stocker")

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      supplierKind: nextKind,
      ...(parsed.data.nom_entreprise ? { name: parsed.data.nom_entreprise } : {}),
    },
    select: { id: true, supplierKind: true, role: true, name: true, email: true },
  })

  if (parsed.data.pays_stock) {
    await upsertMerchantDefaults(userId, { countryCode: parsed.data.pays_stock })
  }

  if (parsed.data.nom_entreprise) {
    await prisma.store
      .updateMany({
        where: { userId },
        data: { name: parsed.data.nom_entreprise },
      })
      .catch(() => undefined)

    await prisma.merchantLegalProfile
      .updateMany({
        where: { userId },
        data: { tradeName: parsed.data.nom_entreprise },
      })
      .catch(() => undefined)
  }

  logger.info("[supplier-profile]", {
    userId,
    result: onboardingComplete ? "onboarding_complete" : "updated",
    supplierKind: updated.supplierKind,
    prevKind,
  })

  trackServer(userId, "supplier_kind_selected_server", {
    kind: nextKind,
    display_kind: getSupplierKindDisplaySlug(nextKind),
    previous_kind: prevKind,
    previous_display_kind: getSupplierKindDisplaySlug(prevKind),
    onboarding_complete: onboardingComplete,
    source: "api_supplier_profile",
  })

  // Welcome email fire-and-forget — never blocks / crashes this POST
  if (nextKind === "producer" || nextKind === "stocker") {
    scheduleSupplierWelcomeEmail({
      userId,
      kind: nextKind as SupplierKindSetValue,
      previousKind: prevKind,
      email: updated.email,
      name: updated.name,
    })
  }

  await flushLogs()

  return NextResponse.json({
    ok: true,
    supplierKind: parseSupplierKind(updated.supplierKind),
    onboardingComplete,
  })
}
