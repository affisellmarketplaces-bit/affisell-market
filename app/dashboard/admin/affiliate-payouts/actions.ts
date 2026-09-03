"use server"

import { revalidatePath } from "next/cache"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export async function verifyAffiliatePayoutMethodAction(formData: FormData) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    throw new Error(gate.error)
  }

  const id = String(formData.get("id") ?? "").trim()
  if (!id) {
    throw new Error("missing_id")
  }

  const updated = await prisma.affiliatePayoutMethod.update({
    where: { id },
    data: { status: "VERIFIED" },
    select: { id: true, affiliateId: true, type: true },
  })

  console.log("[admin-affiliate-payouts]", {
    action: "verify",
    methodId: updated.id,
    affiliateId: updated.affiliateId,
    type: updated.type,
    adminId: gate.session.user.id,
  })

  revalidatePath("/dashboard/admin/affiliate-payouts")
}

export async function rejectAffiliatePayoutMethodAction(formData: FormData) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    throw new Error(gate.error)
  }

  const id = String(formData.get("id") ?? "").trim()
  if (!id) {
    throw new Error("missing_id")
  }

  const existing = await prisma.affiliatePayoutMethod.findUnique({
    where: { id },
    select: { id: true, affiliateId: true, type: true, isDefault: true },
  })
  if (!existing) {
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.affiliatePayoutMethod.delete({ where: { id } })
    if (existing.isDefault) {
      const next = await tx.affiliatePayoutMethod.findFirst({
        where: { affiliateId: existing.affiliateId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
      if (next) {
        await tx.affiliatePayoutMethod.update({
          where: { id: next.id },
          data: { isDefault: true },
        })
      }
    }
  })

  console.log("[admin-affiliate-payouts]", {
    action: "reject",
    methodId: existing.id,
    affiliateId: existing.affiliateId,
    type: existing.type,
    adminId: gate.session.user.id,
  })

  revalidatePath("/dashboard/admin/affiliate-payouts")
}
