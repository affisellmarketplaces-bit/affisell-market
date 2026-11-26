/**
 * Per-variant cost declarations on a REAL PostgreSQL (no migration: AuditLog rows). What must hold end to end:
 * a variant declaration is refused for a variant the product does not have (or an ambiguous one); each scope has its
 * own history and its own qualification; a new declaration starts again at « non vérifiée »; a future effective date
 * is not in force; a supplier can not read or write another supplier's product; the listing is never touched.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { dbTestsRequested, pointAtTestDatabase } from "@/lib/testing/db-test-guard"

vi.mock("server-only", () => ({}))

const RUN_DB = dbTestsRequested()
if (RUN_DB) pointAtTestDatabase()

const stamp = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const cost = (unitCostCents: number) => ({ unitCostCents, deliveryCostCents: 0, source: "own_stock" as const, leadTimeDays: null, minimumOrderQty: null, note: "" })

describe.skipIf(!RUN_DB)("per-variant supply costs — real database", { timeout: 120_000 }, () => {
  let prisma: (typeof import("@/lib/prisma"))["prisma"]
  let srv: typeof import("@/lib/supplier-costs/declaration.server")
  const ids = { supplier: "", other: "", product: "" }

  beforeAll(async () => {
    ;({ prisma } = await import("@/lib/prisma"))
    srv = await import("@/lib/supplier-costs/declaration.server")
    ids.supplier = (await prisma.user.create({ data: { email: `vc-sup-${stamp}@affisell.test`, role: "SUPPLIER", name: "S" } })).id
    ids.other = (await prisma.user.create({ data: { email: `vc-oth-${stamp}@affisell.test`, role: "SUPPLIER", name: "O" } })).id
    ids.product = (
      await prisma.product.create({
        data: {
          supplierId: ids.supplier,
          name: "VC",
          description: "d",
          basePriceCents: 2000,
          commissionRate: 10,
          variants: { variantRows: [{ name: "Noir / M", stock: 3 }, { name: "Noir / L", stock: 2 }, { name: "Rouge / M", stock: 1 }, { name: "rouge / m", stock: 1 }] },
        } as never,
      })
    ).id
  }, 60_000)

  afterAll(async () => {
    if (!prisma) return
    await prisma.auditLog.deleteMany({ where: { entityId: ids.product } })
    await prisma.product.deleteMany({ where: { id: ids.product } })
    await prisma.user.deleteMany({ where: { id: { in: [ids.supplier, ids.other] } } })
    await prisma.$disconnect()
  })

  it("lists only unambiguous variants and refuses an unknown or ambiguous one", async () => {
    const view = await srv.loadSupplierCostView(ids.product, ids.supplier)
    expect(view!.variantOptions.map((o) => o.key).sort()).toEqual(["noir|l", "noir|m"])
    expect(view!.ambiguousVariantKeys).toEqual(["rouge|m"])
    expect(await srv.declareSupplierCost({ productId: ids.product, supplierId: ids.supplier, value: cost(700), variantKey: "rouge|m" })).toEqual({ ok: false, error: "variant_unknown" })
    expect(await srv.declareSupplierCost({ productId: ids.product, supplierId: ids.supplier, value: cost(700), variantKey: "bleu|m" })).toEqual({ ok: false, error: "variant_unknown" })
  })

  it("product-wide and variant declarations have their own history and their own qualification", async () => {
    expect(await srv.declareSupplierCost({ productId: ids.product, supplierId: ids.supplier, value: cost(500) })).toMatchObject({ ok: true })
    expect(await srv.declareSupplierCost({ productId: ids.product, supplierId: ids.supplier, value: cost(800), variantKey: "noir|m" })).toMatchObject({ ok: true })
    // The admin verifies the VARIANT's figure only.
    expect(
      await srv.recordCostQualification({ productId: ids.product, actor: "admin", actorId: "adm", supplierId: null, request: { state: "verified", note: "facture contrôlée" }, variantKey: "noir|m" })
    ).toEqual({ ok: true, declarationN: 1 })
    let view = (await srv.loadSupplierCostView(ids.product, ids.supplier))!
    expect(view.qualification).toBe("unverified")
    const nm = view.variants.find((v) => v.variantKey === "noir|m")!
    expect(nm).toMatchObject({ stillOnProduct: true, latest: { unitCostCents: 800, qualification: "verified" }, inForce: { unitCostCents: 800 } })
    expect(view.variants.find((v) => v.variantKey === "noir|l")).toMatchObject({ latest: null, inForce: null })

    // A new declaration of the variant starts again at « non vérifiée »; the previous one keeps its status in history.
    await srv.declareSupplierCost({ productId: ids.product, supplierId: ids.supplier, value: cost(850), variantKey: "noir|m" })
    view = (await srv.loadSupplierCostView(ids.product, ids.supplier))!
    const again = view.variants.find((v) => v.variantKey === "noir|m")!
    expect(again.latest).toMatchObject({ n: 2, unitCostCents: 850, qualification: "unverified" })
    expect(again.history.find((h) => h.n === 1)).toMatchObject({ qualification: "verified" })
  })

  it("a future effective date is recorded but not in force", async () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString()
    await srv.declareSupplierCost({ productId: ids.product, supplierId: ids.supplier, value: cost(990), variantKey: "noir|l", effectiveFrom: future })
    const view = (await srv.loadSupplierCostView(ids.product, ids.supplier))!
    expect(view.variants.find((v) => v.variantKey === "noir|l")).toMatchObject({ latest: { unitCostCents: 990 }, inForce: null })
  })

  it("the simulation reads both scopes, each with its own key; another supplier sees nothing; the listing is untouched", async () => {
    const all = (await srv.loadDeclarationHistories([ids.product])).get(ids.product)!
    expect(all.filter((d) => !d.variantKey).map((d) => d.unitCostCents)).toEqual([500])
    expect(all.filter((d) => d.variantKey === "noir|m").map((d) => d.unitCostCents).sort()).toEqual([800, 850])
    expect(await srv.loadSupplierCostView(ids.product, ids.other)).toBeNull()
    expect(await srv.declareSupplierCost({ productId: ids.product, supplierId: ids.other, value: cost(1) })).toEqual({ ok: false, error: "not_found" })
    const p = await prisma.product.findUniqueOrThrow({ where: { id: ids.product }, select: { basePriceCents: true, isDraft: true, active: true } })
    expect(p.basePriceCents).toBe(2000)
  })
})
