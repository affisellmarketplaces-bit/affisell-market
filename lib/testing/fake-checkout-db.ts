/**
 * In-memory stand-in for the part of Prisma the checkout fulfilment, the settlement scheduler and the refund handler touch
 * (tests only, no database). A transaction snapshots the state and restores it when the callback throws, so "the decrement
 * rolls back with the order" can be asserted for real.
 *
 * Use it from a test with:
 *   vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/lib/testing/fake-checkout-db")).fakeCheckoutDb.prisma }))
 */
/* The call shapes below mimic Prisma's loosely typed arguments; typing them would only duplicate the schema. */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

function pathValue(json: any, path: string[]): unknown {
  let cur = json
  for (const k of path) cur = cur?.[k]
  return cur
}

function matchesId(value: string, cond: any): boolean {
  if (cond === undefined) return true
  if (typeof cond === "string") return value === cond
  if (cond.in && !cond.in.includes(value)) return false
  if (cond.startsWith !== undefined && !value.startsWith(cond.startsWith)) return false
  if (cond.not !== undefined && value === cond.not) return false
  return true
}

export const fakeCheckoutDb = (() => {
  const db = {
    orders: new Map<string, Row>(),
    products: new Map<string, Row>(),
    listings: new Map<string, Row>(),
    audit: new Map<string, Row>(),
    transferAttempts: [] as Row[],
    transferUpserts: 0,
    seq: 0,
    /** Lets a test make the locked read return a STALE stock (what a missing lock would allow). */
    staleStock: null as null | number,
    /** Makes the order-sale bookkeeping throw (to prove the whole transaction, stock included, rolls back). */
    failRecordSale: false,
    /** Every `SELECT … FOR … UPDATE` issued on a product row: `{ id, sql }`. */
    locks: [] as Array<{ id: string; sql: string }>,
    /** Makes the locked read hand the `variants` json back as text. */
    variantsAsText: false,
    /** True while a `$transaction` callback is running (lets a test assert "never inside the transaction"). */
    inTransaction: false,
  }

  const snapshot = () => ({
    orders: new Map([...db.orders].map(([k, v]) => [k, clone(v)] as [string, Row])),
    products: new Map([...db.products].map(([k, v]) => [k, clone(v)] as [string, Row])),
    audit: new Map([...db.audit].map(([k, v]) => [k, clone(v)] as [string, Row])),
  })
  const restore = (s: ReturnType<typeof snapshot>) => {
    db.orders = s.orders
    db.products = s.products
    db.audit = s.audit
  }

  function orderMatches(o: Row, where: any): boolean {
    if (!where) return true
    if (where.id !== undefined && !matchesId(o.id, where.id)) return false
    if (where.stripeSessionId !== undefined && !matchesId(o.stripeSessionId, where.stripeSessionId)) return false
    if (where.status !== undefined) {
      const st = where.status
      if (typeof st === "string" ? o.status !== st : st?.not !== undefined && o.status === st.not) return false
    }
    if (where.OR && !where.OR.some((w: any) => orderMatches(o, w))) return false
    return true
  }

  function withIncludes(o: Row, include: any): Row {
    if (!include) return o
    return {
      ...o,
      supplier: { stripeAccountId: "acct_supplier", ...(o.supplier ?? {}) },
      affiliate: { stripeAccountId: "acct_affiliate", ...(o.affiliate ?? {}) },
      transferAttempts: db.transferAttempts.filter((a) => a.orderId === o.id),
      product: { shippingCountry: null, ...(o.product ?? {}) },
    }
  }

  const orderApi = {
    findMany: async ({ where }: any = {}) => [...db.orders.values()].filter((o) => orderMatches(o, where)),
    findUnique: async ({ where, include }: any) => {
      const row =
        where.stripeSessionId !== undefined
          ? [...db.orders.values()].find((o) => o.stripeSessionId === where.stripeSessionId)
          : db.orders.get(where.id)
      return row ? withIncludes(row, include) : null
    },
    count: async ({ where }: any = {}) => [...db.orders.values()].filter((o) => orderMatches(o, where)).length,
    update: async ({ where, data }: any) => {
      const row = db.orders.get(where.id)!
      Object.assign(row, clone(data))
      return row
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const o of db.orders.values()) {
        if (orderMatches(o, where)) {
          Object.assign(o, clone(data))
          count++
        }
      }
      return { count }
    },
  }

  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async (strings: TemplateStringsArray, id: string) => {
      const sql = strings.join("?")
      db.locks.push({ id, sql })
      const p = db.products.get(id)
      if (!p) return []
      // the sorted pre-lock only selects the id; the reservation reads the stock columns
      if (!sql.includes('"stock"')) return [{ id }]
      return [
        {
          stock: db.staleStock ?? p.stock,
          variants: db.variantsAsText && p.variants ? JSON.stringify(p.variants) : clone(p.variants),
          listingKind: p.listingKind,
          hasVariants: p.hasVariants ?? false,
        },
      ]
    },
    product: {
      updateMany: async ({ where, data }: any) => {
        const p = db.products.get(where.id)
        if (!p) return { count: 0 }
        if (where.stock?.gte !== undefined && !(p.stock >= where.stock.gte)) return { count: 0 }
        if (where.stock?.gt !== undefined && !(p.stock > where.stock.gt)) return { count: 0 }
        if (data.stock?.decrement !== undefined) p.stock -= data.stock.decrement
        else if (typeof data.stock === "number") p.stock = data.stock
        return { count: 1 }
      },
      update: async ({ where, data }: any) => {
        const p = db.products.get(where.id)!
        if (data.stock !== undefined) p.stock = data.stock
        if (data.variants !== undefined) p.variants = clone(data.variants)
        return p
      },
    },
    order: {
      ...orderApi,
      create: async ({ data }: any) => {
        const row = { id: `o_${++db.seq}`, medusaOrderId: null, bookingSlotId: null, ...clone(data) }
        db.orders.set(row.id, row)
        return row
      },
    },
    affiliateProduct: {
      findUnique: async ({ where }: any) => {
        const l = db.listings.get(where.id)
        if (!l) return null
        const product = db.products.get(l.productId)
        if (!product) return { ...l, product: null }
        return {
          ...clone(l),
          product: { ...clone(product), supplier: { supplierFeeBps: null, supplierFeeBpsCatalog: null, supplierFeeBpsAutoBuy: null } },
          affiliate: { stripeAccountId: null, affiliatePlatformFeeBps: null, store: { partnerListingCode: null } },
        }
      },
      findMany: async ({ where }: any) =>
        [...db.listings.values()]
          .filter((l) => matchesId(l.id, where?.id))
          .map((l) => ({ productId: l.productId, product: db.products.get(l.productId) ? { listingKind: db.products.get(l.productId)!.listingKind } : null })),
      update: async () => ({}),
    },
    supplierLink: { findUnique: async () => null },
    transferAttempt: {
      upsert: async ({ create }: any) => {
        db.transferUpserts++
        db.transferAttempts.push({ ...create })
        return create
      },
    },
  }

  const prisma = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const snap = snapshot()
      db.inTransaction = true
      try {
        return await fn(tx)
      } catch (err) {
        restore(snap)
        throw err
      } finally {
        db.inTransaction = false
      }
    },
    order: { ...orderApi },
    affiliateProduct: { findUnique: tx.affiliateProduct.findUnique },
    transferAttempt: tx.transferAttempt,
    auditLog: {
      create: async ({ data }: any) => {
        if (db.audit.has(data.id)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
        db.audit.set(data.id, { ...clone(data), createdAt: new Date() })
        return data
      },
      findUnique: async ({ where }: any) => db.audit.get(where.id) ?? null,
      findMany: async ({ where }: any = {}) =>
        [...db.audit.values()].filter((r) => {
          if (where?.id !== undefined && !matchesId(r.id, where.id)) return false
          if (where?.action !== undefined && r.action !== where.action) return false
          if (where?.entityId !== undefined && !matchesId(r.entityId ?? "", where.entityId)) return false
          const pj = where?.payload
          if (pj?.path && pathValue(r.payload, pj.path) !== pj.equals) return false
          return true
        }),
    },
  }

  function reset() {
    db.orders.clear()
    db.products.clear()
    db.listings.clear()
    db.audit.clear()
    db.transferAttempts.length = 0
    db.transferUpserts = 0
    db.seq = 0
    db.staleStock = null
    db.failRecordSale = false
    db.locks.length = 0
    db.variantsAsText = false
    db.inTransaction = false
  }

  return { db, prisma, tx, snapshot, restore, reset }
})()
