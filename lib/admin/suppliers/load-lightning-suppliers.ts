import type {
  AdminLightningSupplierRow,
  AdminLightningSuppliersResponse,
} from "@/lib/admin/suppliers/lightning-types"
import { prisma } from "@/lib/prisma"

export async function loadAdminLightningSuppliers(): Promise<AdminLightningSuppliersResponse> {
  const suppliers = await prisma.user.findMany({
    where: { role: "SUPPLIER" },
    select: {
      id: true,
      email: true,
      name: true,
      store: {
        select: { name: true, slug: true, partnerListingCode: true },
      },
      supplierProfile: {
        select: {
          trustScore: true,
          lightningEnabled: true,
          lightningAdminOverride: true,
          stripeAccountId: true,
        },
      },
    },
    orderBy: [{ store: { name: "asc" } }, { email: "asc" }],
  })

  const rows: AdminLightningSupplierRow[] = suppliers.map((supplier) => ({
    userId: supplier.id,
    email: supplier.email,
    name: supplier.name,
    storeName: supplier.store?.name ?? null,
    storeSlug: supplier.store?.slug ?? null,
    partnerListingCode: supplier.store?.partnerListingCode ?? null,
    trustScore: supplier.supplierProfile?.trustScore ?? 50,
    lightningEnabled: supplier.supplierProfile?.lightningEnabled ?? false,
    lightningAdminOverride: supplier.supplierProfile?.lightningAdminOverride ?? false,
    stripeAccountId: supplier.supplierProfile?.stripeAccountId ?? null,
  }))

  return {
    rows,
    counts: {
      total: rows.length,
      lightningOn: rows.filter((row) => row.lightningEnabled).length,
      adminOverride: rows.filter((row) => row.lightningAdminOverride).length,
    },
  }
}
