import type { Prisma } from "@prisma/client"

export class MerchantTenantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MerchantTenantError"
  }
}

/** Reject empty / malformed ids so Prisma `where` is never accidentally wide open. */
export function requireMerchantUserId(raw: unknown, label: "supplier" | "affiliate"): string {
  if (typeof raw !== "string") {
    throw new MerchantTenantError(`Invalid ${label} account`)
  }
  const id = raw.trim()
  if (!id) {
    throw new MerchantTenantError(`Missing ${label} account`)
  }
  return id
}

export function supplierProductsWhere(supplierUserId: string): Prisma.ProductWhereInput {
  return { supplierId: requireMerchantUserId(supplierUserId, "supplier") }
}

export function supplierPublishedProductsWhere(supplierUserId: string): Prisma.ProductWhereInput {
  return {
    ...supplierProductsWhere(supplierUserId),
    active: true,
    isDraft: false,
  }
}

export function supplierDraftProductsWhere(supplierUserId: string): Prisma.ProductWhereInput {
  return {
    ...supplierProductsWhere(supplierUserId),
    isDraft: true,
  }
}

export function affiliateListingsWhere(affiliateUserId: string): Prisma.AffiliateProductWhereInput {
  return { affiliateId: requireMerchantUserId(affiliateUserId, "affiliate") }
}

/** Defense in depth after DB reads — drop rows that do not belong to the tenant. */
export function filterProductsForSupplier<T extends { supplierId: string }>(
  rows: T[],
  supplierUserId: string
): T[] {
  const expected = requireMerchantUserId(supplierUserId, "supplier")
  return rows.filter((row) => row.supplierId === expected)
}

export function filterListingsForAffiliate<T extends { affiliateId: string }>(
  rows: T[],
  affiliateUserId: string
): T[] {
  const expected = requireMerchantUserId(affiliateUserId, "affiliate")
  return rows.filter((row) => row.affiliateId === expected)
}
