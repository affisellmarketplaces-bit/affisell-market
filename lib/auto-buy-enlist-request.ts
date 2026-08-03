import "server-only"

import { enlistAeProductForAutoBuy } from "@/lib/admin/auto-fulfill/enlist-ae-product"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import {
  AUTO_BUY_ENLIST_STATUSES,
  type AutoBuyEnlistRequestDto,
  type AutoBuyEnlistStatus,
} from "@/lib/auto-buy-enlist-request-types"
import { prisma } from "@/lib/prisma"

export type { AutoBuyEnlistRequestDto, AutoBuyEnlistStatus }
export { AUTO_BUY_ENLIST_STATUSES }

function asStatus(raw: string): AutoBuyEnlistStatus {
  if ((AUTO_BUY_ENLIST_STATUSES as readonly string[]).includes(raw)) {
    return raw as AutoBuyEnlistStatus
  }
  return "PENDING_REVIEW"
}

function serialize(row: {
  id: string
  supplierId: string
  aeUrl: string
  aeProductId: string
  nameHint: string | null
  note: string | null
  wholesalePriceCents: number | null
  status: string
  rejectionReason: string | null
  productId: string | null
  reviewedAt: Date | null
  createdAt: Date
  supplier?: { email: string | null; name: string | null } | null
}): AutoBuyEnlistRequestDto {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierEmail: row.supplier?.email ?? null,
    supplierName: row.supplier?.name ?? null,
    aeUrl: row.aeUrl,
    aeProductId: row.aeProductId,
    nameHint: row.nameHint,
    note: row.note,
    wholesalePriceCents: row.wholesalePriceCents,
    status: asStatus(row.status),
    rejectionReason: row.rejectionReason,
    productId: row.productId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createAutoBuyEnlistRequest(input: {
  supplierId: string
  aeUrl: string
  nameHint?: string | null
  note?: string | null
  wholesalePriceCents?: number | null
}): Promise<
  | { ok: true; request: AutoBuyEnlistRequestDto; created: boolean }
  | { ok: false; error: string }
> {
  const aeUrl = input.aeUrl.trim()
  const aeProductId = parseAliExpressProductId(aeUrl)
  if (!aeProductId) return { ok: false, error: "invalid_aliexpress_url" }

  const existing = await prisma.autoBuyEnlistRequest.findUnique({
    where: {
      supplierId_aeProductId: { supplierId: input.supplierId, aeProductId },
    },
    include: { supplier: { select: { email: true, name: true } } },
  })

  if (existing) {
    if (existing.status === "PENDING_REVIEW") {
      return { ok: true, request: serialize(existing), created: false }
    }
    if (existing.status === "APPROVED") {
      return { ok: false, error: "already_approved" }
    }
    // Re-open rejected/cancelled as a fresh pending review
    const reopened = await prisma.autoBuyEnlistRequest.update({
      where: { id: existing.id },
      data: {
        aeUrl,
        nameHint: input.nameHint?.trim() || existing.nameHint,
        note: input.note?.trim() || null,
        wholesalePriceCents: input.wholesalePriceCents ?? existing.wholesalePriceCents,
        status: "PENDING_REVIEW",
        rejectionReason: null,
        reviewedAt: null,
        reviewedById: null,
        productId: null,
      },
      include: { supplier: { select: { email: true, name: true } } },
    })
    console.log("[auto-buy-enlist]", {
      result: "reopened",
      requestId: reopened.id,
      supplierId: input.supplierId,
      aeProductId,
    })
    return { ok: true, request: serialize(reopened), created: true }
  }

  const created = await prisma.autoBuyEnlistRequest.create({
    data: {
      supplierId: input.supplierId,
      aeUrl,
      aeProductId,
      nameHint: input.nameHint?.trim() || null,
      note: input.note?.trim() || null,
      wholesalePriceCents: input.wholesalePriceCents ?? null,
      status: "PENDING_REVIEW",
    },
    include: { supplier: { select: { email: true, name: true } } },
  })

  console.log("[auto-buy-enlist]", {
    result: "created",
    requestId: created.id,
    supplierId: input.supplierId,
    aeProductId,
  })

  return { ok: true, request: serialize(created), created: true }
}

export async function listSupplierAutoBuyEnlistRequests(
  supplierId: string
): Promise<AutoBuyEnlistRequestDto[]> {
  const rows = await prisma.autoBuyEnlistRequest.findMany({
    where: { supplierId },
    include: { supplier: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return rows.map(serialize)
}

export async function listPendingAutoBuyEnlistRequests(
  take = 40
): Promise<AutoBuyEnlistRequestDto[]> {
  const rows = await prisma.autoBuyEnlistRequest.findMany({
    where: { status: "PENDING_REVIEW" },
    include: { supplier: { select: { email: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: Math.min(100, Math.max(1, take)),
  })
  return rows.map(serialize)
}

export async function approveAutoBuyEnlistRequest(input: {
  requestId: string
  adminUserId: string
}): Promise<
  | {
      ok: true
      request: AutoBuyEnlistRequestDto
      productId: string
      enlisted: boolean
    }
  | { ok: false; error: string }
> {
  const row = await prisma.autoBuyEnlistRequest.findUnique({
    where: { id: input.requestId },
    include: { supplier: { select: { email: true, name: true } } },
  })
  if (!row) return { ok: false, error: "not_found" }
  if (row.status === "APPROVED" && row.productId) {
    return {
      ok: true,
      request: serialize(row),
      productId: row.productId,
      enlisted: false,
    }
  }
  if (row.status !== "PENDING_REVIEW" && row.status !== "APPROVED") {
    return { ok: false, error: "not_pending" }
  }

  // Nominations land on Affisell AutoBuy catalog (reseller-ready), not the requester's inventory.
  const enlisted = await enlistAeProductForAutoBuy({
    aeUrl: row.aeUrl,
    name: row.nameHint,
    wholesalePriceCents: row.wholesalePriceCents,
    autoBuyEnabled: true,
    publish: true,
  })

  if (!enlisted.ok) {
    console.log("[auto-buy-enlist]", {
      result: "approve_enlist_failed",
      requestId: row.id,
      error: enlisted.error,
    })
    return { ok: false, error: enlisted.error }
  }

  const updated = await prisma.autoBuyEnlistRequest.update({
    where: { id: row.id },
    data: {
      status: "APPROVED",
      productId: enlisted.productId,
      reviewedById: input.adminUserId,
      reviewedAt: new Date(),
      rejectionReason: null,
    },
    include: { supplier: { select: { email: true, name: true } } },
  })

  console.log("[auto-buy-enlist]", {
    result: "approved",
    requestId: updated.id,
    productId: enlisted.productId,
    created: enlisted.created,
  })

  return {
    ok: true,
    request: serialize(updated),
    productId: enlisted.productId,
    enlisted: enlisted.created,
  }
}

export async function rejectAutoBuyEnlistRequest(input: {
  requestId: string
  adminUserId: string
  reason?: string | null
}): Promise<{ ok: true; request: AutoBuyEnlistRequestDto } | { ok: false; error: string }> {
  const row = await prisma.autoBuyEnlistRequest.findUnique({
    where: { id: input.requestId },
  })
  if (!row) return { ok: false, error: "not_found" }
  if (row.status !== "PENDING_REVIEW") return { ok: false, error: "not_pending" }

  const updated = await prisma.autoBuyEnlistRequest.update({
    where: { id: row.id },
    data: {
      status: "REJECTED",
      rejectionReason: input.reason?.trim() || "rejected_by_admin",
      reviewedById: input.adminUserId,
      reviewedAt: new Date(),
    },
    include: { supplier: { select: { email: true, name: true } } },
  })

  console.log("[auto-buy-enlist]", {
    result: "rejected",
    requestId: updated.id,
    supplierId: updated.supplierId,
  })

  return { ok: true, request: serialize(updated) }
}

export async function cancelAutoBuyEnlistRequest(input: {
  requestId: string
  supplierId: string
}): Promise<{ ok: true; request: AutoBuyEnlistRequestDto } | { ok: false; error: string }> {
  const row = await prisma.autoBuyEnlistRequest.findFirst({
    where: { id: input.requestId, supplierId: input.supplierId },
  })
  if (!row) return { ok: false, error: "not_found" }
  if (row.status !== "PENDING_REVIEW") return { ok: false, error: "not_pending" }

  const updated = await prisma.autoBuyEnlistRequest.update({
    where: { id: row.id },
    data: { status: "CANCELLED" },
    include: { supplier: { select: { email: true, name: true } } },
  })

  return { ok: true, request: serialize(updated) }
}
