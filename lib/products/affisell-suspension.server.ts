import { prisma } from "@/lib/prisma"
import {
  PRODUCT_HOLD_UNVERIFIABLE_ERROR,
  PRODUCT_SUSPENSION_ACTION,
  commercialHolds,
  offSaleCause,
  parseSuspensionState,
  suspensionHistoryId,
  suspensionStateId,
  type CommercialHold,
  type SuspensionReason,
  type SuspensionState,
} from "@/lib/products/affisell-suspension"

export type HoldCheck = { held: false } | { held: true; error: CommercialHold | typeof PRODUCT_HOLD_UNVERIFIABLE_ERROR }

/**
 * May the SUPPLIER put this product on sale / publish it? Fails CLOSED: unreadable recalls or suspension = held
 * (`product_hold_unverifiable`, the supplier is asked to retry) — re-listing a product Affisell withdrew is worse.
 */
export async function checkSupplierMayActivate(productId: string): Promise<HoldCheck> {
  try {
    const [recalls, stateRow] = await Promise.all([
      prisma.productRecall.findMany({ where: { productId }, select: { status: true } }),
      prisma.auditLog.findUnique({ where: { id: suspensionStateId(productId) }, select: { payload: true } }),
    ])
    const holds = commercialHolds({
      recallStatuses: recalls.map((r) => r.status),
      suspension: stateRow ? parseSuspensionState(stateRow.payload) : null,
    })
    return holds.length > 0 ? { held: true, error: holds[0] } : { held: false }
  } catch (error) {
    console.error("[product-hold]", {
      productId,
      result: "hold_unreadable_treated_as_held",
      error: error instanceof Error ? error.message : String(error),
    })
    return { held: true, error: PRODUCT_HOLD_UNVERIFIABLE_ERROR }
  }
}

export type SuspensionView = {
  productId: string
  active: boolean
  cause: ReturnType<typeof offSaleCause>
  holds: CommercialHold[]
  suspension: SuspensionState | null
  history: Array<SuspensionState & { n: number }>
}

export async function loadSuspensionView(productId: string): Promise<SuspensionView | null> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, active: true } })
  if (!product) return null
  const [recalls, stateRow, historyRows] = await Promise.all([
    prisma.productRecall.findMany({ where: { productId }, select: { status: true } }),
    prisma.auditLog.findUnique({ where: { id: suspensionStateId(productId) }, select: { payload: true } }),
    prisma.auditLog.findMany({
      where: { action: PRODUCT_SUSPENSION_ACTION, entityId: productId, NOT: { id: suspensionStateId(productId) } },
      select: { id: true, payload: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])
  const suspension = stateRow ? parseSuspensionState(stateRow.payload) : null
  const holds = commercialHolds({ recallStatuses: recalls.map((r) => r.status), suspension })
  return {
    productId,
    active: product.active,
    cause: offSaleCause({ active: product.active, holds }),
    holds,
    suspension,
    history: historyRows.map((r) => ({ ...parseSuspensionState(r.payload), n: Number(r.id.split(":").pop()) || 0 })),
  }
}

export type SuspendResult =
  | { ok: true; wasActive: boolean }
  | { ok: false; error: "not_found" | "already_suspended" }

/** ADMIN: suspend. Takes the product off sale (`active = false`) in the same transaction as the trace. */
export async function suspendProduct(args: {
  productId: string
  adminId: string
  reason: SuspensionReason
  note: string
}): Promise<SuspendResult> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; active: boolean }>>`
      SELECT "id", "active" FROM "Product" WHERE "id" = ${args.productId} FOR NO KEY UPDATE`
    const product = rows[0]
    if (!product) return { ok: false as const, error: "not_found" as const }
    const current = await tx.auditLog.findUnique({ where: { id: suspensionStateId(args.productId) }, select: { payload: true } })
    if (current && parseSuspensionState(current.payload).state === "suspended") {
      return { ok: false as const, error: "already_suspended" as const }
    }
    const n = (await tx.auditLog.count({ where: { action: PRODUCT_SUSPENSION_ACTION, entityId: args.productId } })) + (current ? 0 : 1)
    const payload = {
      state: "suspended",
      reason: args.reason,
      note: args.note.slice(0, 1000),
      by: args.adminId,
      at: new Date().toISOString(),
      wasActive: product.active,
    }
    await writeSuspensionRows(tx, args.productId, args.adminId, n, payload)
    if (product.active) await tx.product.update({ where: { id: args.productId }, data: { active: false } })
    return { ok: true as const, wasActive: product.active }
  })
}

export type LiftResult = { ok: true; recallStillOpen: boolean } | { ok: false; error: "not_found" | "not_suspended" }

/** ADMIN: lift. Never re-activates the product — the supplier decides whether to put it back on sale. */
export async function liftProductSuspension(args: { productId: string; adminId: string; note: string }): Promise<LiftResult> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Product" WHERE "id" = ${args.productId} FOR NO KEY UPDATE`
    if (!rows[0]) return { ok: false as const, error: "not_found" as const }
    const current = await tx.auditLog.findUnique({ where: { id: suspensionStateId(args.productId) }, select: { payload: true } })
    if (!current || parseSuspensionState(current.payload).state !== "suspended") {
      return { ok: false as const, error: "not_suspended" as const }
    }
    const n = await tx.auditLog.count({ where: { action: PRODUCT_SUSPENSION_ACTION, entityId: args.productId } })
    const payload = { state: "lifted", reason: null, note: args.note.slice(0, 1000), by: args.adminId, at: new Date().toISOString() }
    await writeSuspensionRows(tx, args.productId, args.adminId, n, payload)
    const recalls = await tx.productRecall.findMany({ where: { productId: args.productId }, select: { status: true } })
    const recallStillOpen = commercialHolds({ recallStatuses: recalls.map((r) => r.status), suspension: null }).length > 0
    return { ok: true as const, recallStillOpen }
  })
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function writeSuspensionRows(tx: Tx, productId: string, adminId: string, n: number, payload: Record<string, unknown>) {
  const base = { action: PRODUCT_SUSPENSION_ACTION, entityType: "Product", entityId: productId, actorId: adminId, payload }
  await tx.auditLog.create({ data: { id: suspensionHistoryId(productId, n), ...base } })
  await tx.auditLog.upsert({
    where: { id: suspensionStateId(productId) },
    create: { id: suspensionStateId(productId), ...base },
    update: { payload, actorId: adminId },
  })
}
