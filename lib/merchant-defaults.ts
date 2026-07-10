import "server-only"

import { prisma } from "@/lib/prisma"

export type MerchantDefaultsRow = {
  countryCode: string | null
  warehouseType: string | null
  offerMode: string | null
  defaultCommissionPct: number | null
}

export const MERCHANT_DEFAULT_COMMISSION_PCT = 15

export async function getMerchantDefaults(userId: string): Promise<MerchantDefaultsRow | null> {
  const row = await prisma.merchantDefault.findUnique({
    where: { userId },
    select: {
      countryCode: true,
      warehouseType: true,
      offerMode: true,
      defaultCommissionPct: true,
    },
  })
  return row
}

export async function resolveWizardDefaults(userId: string): Promise<MerchantDefaultsRow> {
  const [saved, profile, publishedCount, avgCommission] = await Promise.all([
    getMerchantDefaults(userId),
    prisma.merchantLegalProfile.findUnique({
      where: { userId },
      select: { countryCode: true },
    }),
    prisma.product.count({
      where: { supplierId: userId, isDraft: false, active: true },
    }),
    prisma.product.aggregate({
      where: { supplierId: userId, isDraft: false, active: true },
      _avg: { commissionRate: true },
    }),
  ])

  const avgPct = avgCommission._avg.commissionRate
  const commissionFromCatalog =
    typeof avgPct === "number" && Number.isFinite(avgPct) && avgPct > 0
      ? Math.round(avgPct)
      : publishedCount > 0
        ? MERCHANT_DEFAULT_COMMISSION_PCT
        : MERCHANT_DEFAULT_COMMISSION_PCT

  return {
    countryCode: saved?.countryCode ?? profile?.countryCode ?? "FR",
    warehouseType: saved?.warehouseType ?? "regional",
    offerMode: saved?.offerMode ?? "NEW",
    defaultCommissionPct: saved?.defaultCommissionPct ?? commissionFromCatalog,
  }
}

export async function upsertMerchantDefaults(
  userId: string,
  patch: Partial<MerchantDefaultsRow>
): Promise<MerchantDefaultsRow> {
  const row = await prisma.merchantDefault.upsert({
    where: { userId },
    create: {
      userId,
      countryCode: patch.countryCode ?? null,
      warehouseType: patch.warehouseType ?? null,
      offerMode: patch.offerMode ?? null,
      defaultCommissionPct: patch.defaultCommissionPct ?? null,
    },
    update: {
      ...(patch.countryCode !== undefined ? { countryCode: patch.countryCode } : {}),
      ...(patch.warehouseType !== undefined ? { warehouseType: patch.warehouseType } : {}),
      ...(patch.offerMode !== undefined ? { offerMode: patch.offerMode } : {}),
      ...(patch.defaultCommissionPct !== undefined
        ? { defaultCommissionPct: patch.defaultCommissionPct }
        : {}),
    },
    select: {
      countryCode: true,
      warehouseType: true,
      offerMode: true,
      defaultCommissionPct: true,
    },
  })

  console.log("[merchant-defaults]", { userId, result: "upserted" })
  return row
}
