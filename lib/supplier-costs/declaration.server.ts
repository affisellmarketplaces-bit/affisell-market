import "server-only"

import { prisma } from "@/lib/prisma"
import { compareDeclaredWithObserved } from "@/lib/supplier-costs/declared-vs-observed"
import { entryFromOrderSnapshot } from "@/lib/supplier-costs/observed-cost-register"
import { listVariantOptions, type VariantOption } from "@/lib/supplier-costs/variant-key"
import {
  COST_QUALIFICATION_ACTION,
  VARIANT_COST_QUALIFICATION_ACTION,
  currentQualification,
  parseQualificationEvent,
  qualificationEventId,
  variantQualificationEventId,
  type CostQualification,
  type QualificationActor,
  type QualificationEvent,
  type QualificationRequest,
} from "@/lib/supplier-costs/qualification"
import {
  SUPPLIER_COST_ACTION,
  VARIANT_COST_ACTION,
  declarationEffectiveAt,
  declarationWarnings,
  variantCostHistoryId,
  parseStoredDeclaration,
  supplierCostHistoryId,
  supplierCostStateId,
  type StoredDeclaration,
  type SupplierCostDeclaration,
} from "@/lib/supplier-costs/declaration"

export type SupplierCostView = {
  current: StoredDeclaration | null
  /** The product-wide declaration in force NOW (the latest may only take effect later). */
  inForce: HistoryItem | null
  /** Version number of the current declaration (its history row). */
  currentN: number | null
  /** Qualification of the CURRENT declaration (a new declaration starts again at `unverified`). */
  qualification: CostQualification
  qualificationEvents: QualificationEvent[]
  history: Array<StoredDeclaration & { n: number; qualification: CostQualification }>
  supplierPriceCents: number
  warnings: string[]
  /** Variants a cost can be declared for (ambiguous ones excluded) and each variant's own declarations. */
  variantOptions: VariantOption[]
  ambiguousVariantKeys: string[]
  variants: VariantCostView[]
}

export type HistoryItem = StoredDeclaration & { n: number; qualification: CostQualification }

export type VariantCostView = {
  variantKey: string
  label: string
  /** False when the variant no longer exists on the product (its history is kept, it can not be declared again). */
  stillOnProduct: boolean
  /** The latest declaration (by number) — the one a qualification applies to; may not be in force yet. */
  latest: HistoryItem | null
  /** The one in force now (effective date reached). */
  inForce: HistoryItem | null
  history: HistoryItem[]
}

async function loadQualificationEvents(
  productIds: ReadonlyArray<string>,
  action: string = COST_QUALIFICATION_ACTION
): Promise<Map<string, QualificationEvent[]>> {
  const out = new Map<string, QualificationEvent[]>()
  if (productIds.length === 0) return out
  const rows = await prisma.auditLog.findMany({
    where: { action, entityId: { in: [...productIds] } },
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
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, supplierId: true, basePriceCents: true, variants: true, productVariants: { select: { color: true, size: true } } },
  })
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
    .map((x) => ({ ...x.d, variantKey: null, variantLabel: null, n: x.n, qualification: currentQualification(events, x.n) }))
  const nowMs = Date.now()
  const inForce =
    history
      .filter((h) => declarationEffectiveAt(h) <= nowMs)
      .sort((a, b) => declarationEffectiveAt(b) - declarationEffectiveAt(a) || Date.parse(b.declaredAt) - Date.parse(a.declaredAt))[0] ?? null
  const currentN = history.length > 0 ? Math.max(...history.map((h) => h.n)) : null
  const { options, ambiguousKeys } = listVariantOptions({ variants: product.variants, tableRows: product.productVariants })
  const variantHistory = await loadVariantHistory(productId)
  return {
    current,
    inForce,
    currentN,
    qualification: currentN === null ? "unverified" : currentQualification(events, currentN),
    qualificationEvents: events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    history,
    supplierPriceCents: product.basePriceCents,
    warnings: current ? declarationWarnings(current, product.basePriceCents) : [],
    variantOptions: options,
    ambiguousVariantKeys: ambiguousKeys,
    variants: buildVariantViews(variantHistory, options, new Date()),
  }
}

/** Every variant declaration of a product, with its own qualification (variant events only). */
async function loadVariantHistory(productId: string): Promise<HistoryItem[]> {
  const [rows, events] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: VARIANT_COST_ACTION, entityId: productId },
      select: { id: true, payload: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    loadQualificationEvents([productId], VARIANT_COST_QUALIFICATION_ACTION),
  ])
  const ev = events.get(productId) ?? []
  return rows
    .map((r) => ({ d: parseStoredDeclaration(r.payload), n: Number(r.id.split(":").pop()) || 0 }))
    .filter((x): x is { d: StoredDeclaration; n: number } => x.d !== null && !!x.d.variantKey && x.n > 0)
    .map((x) => ({ ...x.d, n: x.n, qualification: currentQualification(ev, x.n) }))
}

function buildVariantViews(history: ReadonlyArray<HistoryItem>, options: ReadonlyArray<VariantOption>, now: Date): VariantCostView[] {
  const keys = new Map<string, string>()
  for (const o of options) keys.set(o.key, o.label)
  for (const h of history) if (h.variantKey && !keys.has(h.variantKey)) keys.set(h.variantKey, h.variantLabel ?? h.variantKey)
  const onProduct = new Set(options.map((o) => o.key))
  return [...keys.entries()].map(([variantKey, label]) => {
    const own = history.filter((h) => h.variantKey === variantKey).sort((a, b) => b.n - a.n)
    const effective = own.filter((h) => declarationEffectiveAt(h) <= now.getTime())
    const inForce =
      effective.sort((a, b) => declarationEffectiveAt(b) - declarationEffectiveAt(a) || Date.parse(b.declaredAt) - Date.parse(a.declaredAt))[0] ?? null
    return { variantKey, label, stillOnProduct: onProduct.has(variantKey), latest: own[0] ?? null, inForce, history: own }
  })
}

/** Every declaration of a set of products, with its version and qualification, for the read-only simulation (admin). */
export async function loadDeclarationHistories(
  productIds: ReadonlyArray<string>
): Promise<Map<string, Array<StoredDeclaration & { n: number; qualification: CostQualification }>>> {
  const out = new Map<string, Array<StoredDeclaration & { n: number; qualification: CostQualification }>>()
  if (productIds.length === 0) return out
  const [rows, events, variantRows, variantEvents] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: SUPPLIER_COST_ACTION, entityId: { in: [...productIds] } },
      select: { id: true, entityId: true, payload: true },
    }),
    loadQualificationEvents(productIds),
    prisma.auditLog.findMany({
      where: { action: VARIANT_COST_ACTION, entityId: { in: [...productIds] } },
      select: { id: true, entityId: true, payload: true },
    }),
    loadQualificationEvents(productIds, VARIANT_COST_QUALIFICATION_ACTION),
  ])
  for (const r of rows) {
    if (!r.entityId || r.id === supplierCostStateId(r.entityId)) continue
    const d = parseStoredDeclaration(r.payload)
    if (!d) continue
    const n = Number(r.id.split(":").pop()) || 0
    const list = out.get(r.entityId) ?? []
    // A product-wide row never carries a variant key (a stray key would turn it into one variant's cost).
    list.push({ ...d, variantKey: null, variantLabel: null, n, qualification: currentQualification(events.get(r.entityId) ?? [], n) })
    out.set(r.entityId, list)
  }
  for (const r of variantRows) {
    if (!r.entityId) continue
    const d = parseStoredDeclaration(r.payload)
    if (!d || !d.variantKey) continue // a variant row without its key is not trusted as anything
    const n = Number(r.id.split(":").pop()) || 0
    const list = out.get(r.entityId) ?? []
    list.push({ ...d, n, qualification: currentQualification(variantEvents.get(r.entityId) ?? [], n) })
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
  /** Qualify the latest declaration of THIS variant instead of the product-wide one. */
  variantKey?: string | null
}): Promise<{ ok: true; declarationN: number } | { ok: false; error: "not_found" | "no_declaration" }> {
  const product = await ownedProduct(args.productId, args.supplierId)
  if (!product) return { ok: false, error: "not_found" }
  if (args.variantKey) return recordVariantQualification({ ...args, variantKey: args.variantKey })
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

async function recordVariantQualification(args: {
  productId: string
  actor: QualificationActor
  actorId: string
  request: QualificationRequest
  variantKey: string
}): Promise<{ ok: true; declarationN: number } | { ok: false; error: "no_declaration" }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${args.productId} FOR NO KEY UPDATE`
    const rows = await tx.auditLog.findMany({ where: { action: VARIANT_COST_ACTION, entityId: args.productId }, select: { id: true, payload: true } })
    const ns = rows
      .map((r) => ({ d: parseStoredDeclaration(r.payload), n: Number(r.id.split(":").pop()) || 0 }))
      .filter((x) => x.d?.variantKey === args.variantKey && x.n > 0)
      .map((x) => x.n)
    if (ns.length === 0) return { ok: false as const, error: "no_declaration" as const }
    const n = Math.max(...ns)
    const k =
      (await tx.auditLog.count({
        where: {
          action: VARIANT_COST_QUALIFICATION_ACTION,
          entityId: args.productId,
          id: { startsWith: `supplier-cost-vq:${args.productId}:${n}:` },
        },
      })) + 1
    await tx.auditLog.create({
      data: {
        id: variantQualificationEventId(args.productId, n, k),
        action: VARIANT_COST_QUALIFICATION_ACTION,
        entityType: "Product",
        entityId: args.productId,
        actorId: args.actorId,
        payload: {
          declarationN: n,
          variantKey: args.variantKey,
          state: args.request.state,
          by: args.actorId,
          role: args.actor,
          note: args.request.note,
          at: new Date().toISOString(),
        },
      },
    })
    return { ok: true as const, declarationN: n }
  })
}

/**
 * The supplier declares (or updates) its cost — for the whole product, or for ONE variant (`variantKey`, which must be a
 * current, unambiguous variant of the product). A new history row every time; nothing is rewritten. `effectiveFrom`
 * (already validated by `parseEffectiveFrom`) is when it starts to apply — never before now.
 */
export async function declareSupplierCost(args: {
  productId: string
  supplierId: string
  value: SupplierCostDeclaration
  effectiveFrom?: string
  variantKey?: string | null
}): Promise<{ ok: true; warnings: string[] } | { ok: false; error: "not_found" | "variant_unknown" }> {
  const product = await ownedProduct(args.productId, args.supplierId)
  if (!product) return { ok: false, error: "not_found" }
  const declaredAt = new Date().toISOString()
  const effectiveFrom = args.effectiveFrom && Date.parse(args.effectiveFrom) >= Date.parse(declaredAt) ? args.effectiveFrom : declaredAt
  if (args.variantKey) {
    const { options } = listVariantOptions({ variants: product.variants, tableRows: product.productVariants })
    const option = options.find((o) => o.key === args.variantKey)
    if (!option) return { ok: false, error: "variant_unknown" }
    const payload = {
      ...args.value,
      declaredAt,
      effectiveFrom,
      declaredBy: args.supplierId,
      variantKey: option.key,
      variantLabel: option.label,
    }
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${args.productId} FOR NO KEY UPDATE`
      const n = (await tx.auditLog.count({ where: { action: VARIANT_COST_ACTION, entityId: args.productId } })) + 1
      await tx.auditLog.create({
        data: {
          id: variantCostHistoryId(args.productId, n),
          action: VARIANT_COST_ACTION,
          entityType: "Product",
          entityId: args.productId,
          actorId: args.supplierId,
          payload,
        },
      })
    })
    return { ok: true, warnings: declarationWarnings(args.value, product.basePriceCents) }
  }
  const payload = { ...args.value, declaredAt, effectiveFrom, declaredBy: args.supplierId }
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
    select: { id: true, paidAt: true, quantity: true, aeWholesaleCents: true, currency: true, variantLabel: true },
    orderBy: { paidAt: "desc" },
    take: 500,
  })
  const entries = orders
    .map((o) =>
      o.paidAt
        ? entryFromOrderSnapshot({
            orderId: o.id,
            productId,
            paidAt: o.paidAt,
            quantity: o.quantity,
            aeWholesaleCents: o.aeWholesaleCents,
            currency: o.currency,
            variantLabel: o.variantLabel,
          })
        : null
    )
    .filter((e): e is NonNullable<typeof e> => e !== null)
  const comparison = compareDeclaredWithObserved([...view.history, ...view.variants.flatMap((v) => v.history)], entries)
  return { ...view, observed: comparison, observedTruncated: orders.length >= 500 }
}
