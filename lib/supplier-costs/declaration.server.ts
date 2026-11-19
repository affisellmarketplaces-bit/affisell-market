import "server-only"

import { prisma } from "@/lib/prisma"
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
  history: Array<StoredDeclaration & { n: number }>
  supplierPriceCents: number
  warnings: string[]
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
  const history = rows
    .filter((r) => r.id !== supplierCostStateId(productId))
    .map((r) => ({ d: parseStoredDeclaration(r.payload), n: Number(r.id.split(":").pop()) || 0 }))
    .filter((x): x is { d: StoredDeclaration; n: number } => x.d !== null)
    .map((x) => ({ ...x.d, n: x.n }))
  return {
    current,
    history,
    supplierPriceCents: product.basePriceCents,
    warnings: current ? declarationWarnings(current, product.basePriceCents) : [],
  }
}

/** Every declaration of a set of products, for the read-only contract simulation (admin). */
export async function loadDeclarationHistories(productIds: ReadonlyArray<string>): Promise<Map<string, StoredDeclaration[]>> {
  const out = new Map<string, StoredDeclaration[]>()
  if (productIds.length === 0) return out
  const rows = await prisma.auditLog.findMany({
    where: { action: SUPPLIER_COST_ACTION, entityId: { in: [...productIds] } },
    select: { id: true, entityId: true, payload: true },
  })
  for (const r of rows) {
    if (!r.entityId || r.id === supplierCostStateId(r.entityId)) continue
    const d = parseStoredDeclaration(r.payload)
    if (!d) continue
    const list = out.get(r.entityId) ?? []
    list.push(d)
    out.set(r.entityId, list)
  }
  return out
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
