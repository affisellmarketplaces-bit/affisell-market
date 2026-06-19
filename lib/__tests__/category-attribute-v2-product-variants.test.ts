import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { PrismaClient } from "@prisma/client"

import { syncVariantAttributeValues } from "@/lib/variant-attribute-values"

const prisma = new PrismaClient()
const RUN_DB = Boolean(process.env.DATABASE_URL?.trim())

describe.skipIf(!RUN_DB)("category attribute v2 — parent product + 6 variants", () => {
  const cleanup: {
    productId?: string
    supplierId?: string
    categoryId?: string
    attributeIds: string[]
    optionIds: string[]
  } = { attributeIds: [], optionIds: [] }

  beforeAll(async () => {
    const supplier = await prisma.user.create({
      data: {
        email: `v2-variant-test-${Date.now()}@affisell.test`,
        role: "SUPPLIER",
        name: "Variant Test Supplier",
      },
    })
    cleanup.supplierId = supplier.id

    const category = await prisma.category.create({
      data: {
        name: "Smartphones Test",
        slug: `smartphones-test-${Date.now()}`,
        isLeaf: true,
        level: 3,
        fullPath: "Test > Smartphones Test",
      },
    })
    cleanup.categoryId = category.id

    const colorAttr = await prisma.attribute.create({
      data: {
        slug: `color-test-${Date.now()}`,
        name: "Couleur",
        type: "SELECT_SINGLE",
      },
    })
    cleanup.attributeIds.push(colorAttr.id)

    const storageAttr = await prisma.attribute.create({
      data: {
        slug: `storage-test-${Date.now()}`,
        name: "Stockage",
        type: "SELECT_SINGLE",
        unit: "Go",
      },
    })
    cleanup.attributeIds.push(storageAttr.id)

    const black = await prisma.attributeOption.create({
      data: { attributeId: colorAttr.id, value: "Noir", slug: "noir", sortOrder: 1 },
    })
    const white = await prisma.attributeOption.create({
      data: { attributeId: colorAttr.id, value: "Blanc", slug: "blanc", sortOrder: 2 },
    })
    cleanup.optionIds.push(black.id, white.id)

    await prisma.categoryAttribute.createMany({
      data: [
        {
          categoryId: category.id,
          attributeId: colorAttr.id,
          key: "color",
          label: "Couleur",
          type: "SELECT_SINGLE",
          required: true,
          order: 1,
          isVariant: true,
        },
        {
          categoryId: category.id,
          attributeId: storageAttr.id,
          key: "storage_gb",
          label: "Stockage (Go)",
          type: "SELECT_SINGLE",
          required: true,
          order: 2,
          isVariant: true,
          options: ["128", "256"],
        },
      ],
    })

    const product = await prisma.product.create({
      data: {
        supplierId: supplier.id,
        name: "Smartphone Test Parent",
        description: "Parent listing for variant matrix test",
        basePriceCents: 49900,
        commissionRate: 10,
        categoryId: category.id,
        isVariantParent: true,
        hasVariants: true,
        active: true,
      },
    })
    cleanup.productId = product.id

    const combos = [
      { color: "Noir", size: "128", optionId: black.id, storage: "128" },
      { color: "Noir", size: "256", optionId: black.id, storage: "256" },
      { color: "Blanc", size: "128", optionId: white.id, storage: "128" },
      { color: "Blanc", size: "256", optionId: white.id, storage: "256" },
      { color: "Noir", size: "512", optionId: black.id, storage: "512" },
      { color: "Blanc", size: "512", optionId: white.id, storage: "512" },
    ]

    await prisma.$transaction(async (tx) => {
      for (const combo of combos) {
        const variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            color: combo.color,
            size: combo.size,
            sku: `TST-${combo.color.slice(0, 3).toUpperCase()}-${combo.size}`,
            supplierPrice: 350,
            publicPrice: 499,
            stock: 5,
          },
        })

        await syncVariantAttributeValues(tx, variant.id, [
          { attributeId: colorAttr.id, optionId: combo.optionId, valueText: combo.color },
          {
            attributeId: storageAttr.id,
            valueText: combo.storage,
            valueNumber: Number(combo.storage),
          },
        ])
      }
    })
  })

  afterAll(async () => {
    if (cleanup.productId) {
      await prisma.variantAttributeValue.deleteMany({
        where: { variant: { productId: cleanup.productId } },
      })
      await prisma.productVariant.deleteMany({ where: { productId: cleanup.productId } })
      await prisma.product.deleteMany({ where: { id: cleanup.productId } })
    }
    if (cleanup.categoryId) {
      await prisma.categoryAttribute.deleteMany({ where: { categoryId: cleanup.categoryId } })
      await prisma.category.deleteMany({ where: { id: cleanup.categoryId } })
    }
    if (cleanup.optionIds.length) {
      await prisma.attributeOption.deleteMany({ where: { id: { in: cleanup.optionIds } } })
    }
    if (cleanup.attributeIds.length) {
      await prisma.attribute.deleteMany({ where: { id: { in: cleanup.attributeIds } } })
    }
    if (cleanup.supplierId) {
      await prisma.user.deleteMany({ where: { id: cleanup.supplierId } })
    }
    await prisma.$disconnect()
  })

  it("creates 1 parent product flagged isVariantParent with 6 sellable variants", async () => {
    expect(cleanup.productId).toBeTruthy()
    const product = await prisma.product.findUnique({
      where: { id: cleanup.productId! },
      select: { isVariantParent: true, hasVariants: true, categoryId: true },
    })
    expect(product?.isVariantParent).toBe(true)
    expect(product?.hasVariants).toBe(true)
    expect(product?.categoryId).toBe(cleanup.categoryId)

    const variants = await prisma.productVariant.findMany({
      where: { productId: cleanup.productId! },
      orderBy: { sku: "asc" },
    })
    expect(variants).toHaveLength(6)

    const eavCount = await prisma.variantAttributeValue.count({
      where: { variant: { productId: cleanup.productId! } },
    })
    expect(eavCount).toBe(12)
  })
})

describe("category attribute catalog (unit)", () => {
  it("maps legacy SELECT type to SELECT_SINGLE", async () => {
    const { mapLegacyTypeToEnum } = await import("@/lib/category-attribute-catalog")
    expect(mapLegacyTypeToEnum("SELECT", null)).toBe("SELECT_SINGLE")
    expect(mapLegacyTypeToEnum("NUMBER", "Go")).toBe("UNIT_VALUE")
  })
})
