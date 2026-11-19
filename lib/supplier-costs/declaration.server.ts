import "server-only"

import { prisma } from "@/lib/prisma"
import { compareDeclaredWithObserved } from "@/lib/supplier-costs/declared-vs-observed"
import {
  COST_QUALIFICATION_ACTION,
  currentQualification,
  parseQualificationEvent,
  qualificationEventId,
  type CostQualification,
  type QualificationActor,
  type QualificationEvent,
  type QualificationRequest,
} from "@/lib/supplier-costs/qualification"
import {
  SUPPLIER_COST_ACTION,
  declarationWarnings,
  parseStoredDeclaration,
  supplierCostHistoryId,
  supplierCostStateId,
  type StoredDeclaration,
  type SupplierCostDeclaration,
} from "@/lib/supplier-costs/declaration"

export type SupplierCostView = {
  current: StoredDeclaration | null
  /** Version number of the current declaration (its history row). */
  currentN: number | null
  /** Qualification of the CURRENT declaration (a new declaration starts again at `unverified`). */
  qualification: CostQualification
  qualificationEvents: QualificationEvent[]
  history: Array<StoredDeclaration & { n: number; qualification: CostQualification }>
  supplierPriceCents: number
  warnings: string[]
}

async function loadQualificationEvents(productIds: ReadonlyArray<string>): Promise<Map<string, QualificationEvent[]>> {
  const out = new Map<string, QualificationEvent[]>()
  if (productIds.length === 0) return out
  const rows = await prisma.auditLog.findMany({
    where: { action: COST_QUALIFICATION_ACTION, entityId: { in: [...productIds] } },
    select: { entityId: true, payload: true },
  })
  for (const r of rows) {
    const e = parseQualificationEvent(r.payload)
    if (!e || !r.entityId) continue
    out.set(r.entityId, [...(out.get(r.entityId) ?? []), e])
  }
  return out
}

async function ownedProduct(productId: string, supplierId: string | null) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, supplierId: true, basePriceCents: true } })
  if (!p) return null
  if (supplierId !== null && p.supplierId !== supplierId) return null
  return p
}

/** The supplier's own declarations (or any product's, for an admin: `supplierId = null`). Null = not found / not owned. */
export async function loadSupplierCostView(productId: string, supplierId: string | null): Promise<SupplierCostView | null> {
  const product = await ownedProduct(productId, supplierId)
  if (!product) return null
  const rows = await prisma.auditLog.findMany({
    where: { action: SUPPLIER_COST_ACTION, entityId: productId },
    select: { id: true, payload: true },
    orderBy: { createdAt: "desc" },
    take: 60,
  })
  const current = parseStoredDeclaration(rows.find((r) => r.id === supplierCostStateId(productId))?.payload)
  const events = (await loadQualificationEvents([productId])).get(productId) ?? []
  const history = rows
    .filter((r) => r.id !== supplierCostStateId(productId))
    .map((r) => ({ d: parseStoredDeclaration(r.payload), n: Number(r.id.split(":").pop()) || 0 }))
    .filter((x): x is { d: StoredDeclaration; n: number } => x.d !== null)
    .map((x) => ({ ...x.d, n: x.n, qualification: currentQualification(events, x.n) }))
  const currentN = history.length > 0 ? Math.max(...history.map((h) => h.n)) : null
  return {
    current,
    currentN,
    qualification: currentN === null ? "unverified" : currentQualification(events, currentN),
    qualificationEvents: events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    history,
    supplierPriceCents: product.basePriceCents,
    warnings: current ? declarationWarnings(current, product.basePriceCents) : [],
  }
}

/** Every declaration of a set of products, with its version and qualification, for the read-only simulation (admin). */
export async function loadDeclarationHistories(
  productIds: ReadonlyArray<string>
): Promise<Map<string, Array<StoredDeclaration & { n: number; qualification: CostQualification }>>> {
  const out = new Map<string, Array<StoredDeclaration & { n: number; qualification: CostQualification }>>()
  if (productIds.length === 0) return out
  const [rows, events] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: SUPPLIER_COST_ACTION, entityId: { in: [...productIds] } },
      select: { id: true, entityId: true, payload: true },
    }),
    loadQualificationEvents(productIds),
  ])
  for (const r of rows) {
    if (!r.entityId || r.id === supplierCostStateId(r.entityId)) continue
    const d = parseStoredDeclaration(r.payload)
    if (!d) continue
    const n = Number(r.id.split(":").pop()) || 0
    const list = out.get(r.entityId) ?? []
    list.push({ ...d, n, qualification: currentQualification(events.get(r.entityId) ?? [], n) })
    out.set(r.entityId, list)
  }
  return out
}

/**
 * Records a qualification of the CURRENT declaration, by a person. A supplier may only announce a document (on its own
 * product); verified / disputed / expired are admin decisions. Never called by any automatic process.
 */
export async function recordCostQualification(args: {
  productId: string
  actor: QualificationActor
  actorId: string
  /** The supplier's id when the actor is a supplier (ownership check); null for an admin. */
  supplierId: string | null
  request: QualificationRequest
}): Promise<{ ok: true; declarationN: number } | { ok: false; error: "not_found" | "no_declaration" }> {
  const product = await ownedProduct(args.productId, args.supplierId)
  if (!product) return { ok: false, error: "not_found" }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${args.productId} FOR NO KEY UPDATE`
    const n = await tx.auditLog.count({
      where: { action: SUPPLIER_COST_ACTION, entityId: args.productId, NOT: { id: supplierCostStateId(args.productId) } },
    })
    if (n === 0) return { ok: false as const, error: "no_declaration" as const }
    const k =
      (await tx.auditLog.count({
        where: { action: COST_QUALIFICATION_ACTION, entityId: args.productId, id: { startsWith: `supplier-cost-qualification:${args.productId}:${n}:` } },
      })) + 1
    const payload = {
      declarationN: n,
      state: args.request.state,
      by: args.actorId,
      role: args.actor,
      note: args.request.note,
      at: new Date().toISOString(),
    }
    await tx.auditLog.create({
      data: {
        id: qualificationEventId(args.productId, n, k),
        action: COST_QUALIFICATION_ACTION,
        entityType: "Product",
        entityId: args.productId,
        actorId: args.actorId,
        payload,
      },
    })
    return { ok: true as const, declarationN: n }
  })
}

/** The supplier declares (or updates) its cost. A new history row every time; the current row is replaced. */
export async function declareSupplierCost(args: {
  productId: string
  supplierId: string
  value: SupplierCostDeclaration
}): Promise<{ ok: true; warnings: string[] } | { ok: false; error: "not_found" }> {
  const product = await ownedProduct(args.productId, args.supplierId)
  if (!product) return { ok: false, error: "not_found" }
  const payload = { ...args.value, declaredAt: new Date().toISOString(), declaredBy: args.supplierId }
  await prisma.$transaction(async (tx) => {
    // Serialises two saves of the same product so history numbers never collide.
    await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${args.productId} FOR NO KEY UPDATE`
    const n =
      (await tx.auditLog.count({
        where: { action: SUPPLIER_COST_ACTION, entityId: args.productId, NOT: { id: supplierCostStateId(args.productId) } },
      })) + 1
    const base = { action: SUPPLIER_COST_ACTION, entityType: "Product", entityId: args.productId, actorId: args.supplierId, payload }
    await tx.auditLog.create({ data: { id: supplierCostHistoryId(args.productId, n), ...base } })
    await tx.auditLog.upsert({
      where: { id: supplierCostStateId(args.productId) },
      create: { id: supplierCostStateId(args.productId), ...base },
      update: { payload, actorId: args.supplierId },
    })
  })
  return { ok: true, warnings: declarationWarnings(args.value, product.basePriceCents) }
}

/**
 * ADMIN review of one product: every declaration with its qualification, and the comparison with the costs Affisell
 * itself recorded on auto-buy orders of the same product (kept apart — see declared-vs-observed.ts). Read-only.
 */
export async function loadAdminSupplierCostReview(productId: string) {
  const view = await loadSupplierCostView(productId, null)
  if (!view) return null
  const since = new Date(Date.now() - 365 * 86_400_000)
  const orders = await prisma.order.findMany({
    where: { productId, usesAffisellAutoBuy: true, aeWholesaleCents: { gt: 0 }, paidAt: { gte: since } },
    select: { id: true, paidAt: true, quantity: true, aeWholesaleCents: true },
    orderBy: { paidAt: "desc" },
    take: 500,
  })
  const comparison = compareDeclaredWithObserved(
    view.history,
    orders
      .filter((o) => o.paidAt && o.aeWholesaleCents)
      .map((o) => ({ orderId: o.id, paidAt: o.paidAt!, quantity: o.quantity, observedTotalCents: o.aeWholesaleCents!, kind: "order_snapshot" as const }))
  )
  return { ...view, observed: comparison, observedTruncated: orders.length >= 500 }
}
