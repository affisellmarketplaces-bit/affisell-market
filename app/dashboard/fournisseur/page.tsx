import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { FournisseurLiveDashboard } from "./live-dashboard"

export default async function FournisseurDashboardPage() {
  const session = await auth()
  const user = session?.user ?? { id: "seed-supplier", email: "test@local.dev", name: "Test" }

  if (user.id === "seed-supplier") {
    await prisma.user.upsert({
      where: { id: "seed-supplier" },
      update: {},
      create: { id: "seed-supplier", email: "test@local.dev", name: "Test" },
    })
  }

  const [products, stats, salesByProductRaw, topAffiliatesRaw] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: { product: { supplierId: user.id } },
    }),
    prisma.order.groupBy({
      by: ["productId"],
      where: { product: { supplierId: user.id }, productId: { not: null } },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ["affiliateId"],
      where: {
        product: { supplierId: user.id },
        affiliateId: { not: null },
      },
      _count: { id: true },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
  ])

  const ids = salesByProductRaw.map((row) => row.productId).filter(Boolean) as string[]
  const affiliateIds = topAffiliatesRaw
    .map((row) => row.affiliateId)
    .filter(Boolean) as string[]

  const [productNames, affiliates] = await Promise.all([
    ids.length
      ? prisma.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    affiliateIds.length
      ? prisma.user.findMany({
          where: { id: { in: affiliateIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ])

  const nameByProductId = new Map(productNames.map((p) => [p.id, p.name] as const))
  const affiliateById = new Map(
    affiliates.map((a) => [a.id, a.name || a.email || "Affilie"] as const)
  )

  const salesByProduct = salesByProductRaw.map((row) => ({
    produit: nameByProductId.get(row.productId ?? "") ?? "Produit supprime",
    ventes: row._count.id,
  }))

  const topAffiliates = topAffiliatesRaw.map((row) => ({
    nom: affiliateById.get(row.affiliateId ?? "") ?? "Affilie inconnu",
    ventes: row._count.id,
    commission: Math.round(((row._sum.amount ?? 0) * 0.3) / 100),
  }))

  const commissionsAPayer = topAffiliates.reduce((sum, a) => sum + a.commission, 0)

  return (
    <FournisseurLiveDashboard
      user={user}
      kpis={{
        ventesTotales: stats._count.id,
        revenus: Math.round((stats._sum.amount ?? 0) / 100),
        affiliesActifs: topAffiliates.length,
        commissionsAPayer,
      }}
      salesByProduct={salesByProduct}
      topAffiliates={topAffiliates}
      products={products}
    />
  )
}
