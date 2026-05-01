import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { FournisseurLiveDashboard } from "./live-dashboard"

export default async function FournisseurDashboardPage() {
  const session = await auth()
  const user = session?.user?? { id: "seed-supplier", email: "fournisseur@test.dev", name: "Test" };
  await prisma.user.upsert({
  where:{id:user.id},
  update:{},
  create:{ id:user.id, email:user.email!, name:user.name }
});

  const products = await prisma.product.findMany({
    where: { supplierId: user.id },
    orderBy: { createdAt: "desc" },
  })
  const orders = await prisma.order.findMany({
    where: { product: { supplierId: user.id } },
  })

  const productIds = products.map((p) => p.id)

  const salesByProductRaw =
    productIds.length > 0
      ? await prisma.order.groupBy({
          by: ["productId"],
          where: { productId: { in: productIds } },
          _count: { id: true },
        })
      : []

  const topAffiliatesRaw = await prisma.order.groupBy({
    by: ["affiliateId"],
    where: {
      product: { supplierId: user.id },
      affiliateId: { not: null },
    },
    _count: { id: true },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 5,
  })

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
        ventesTotales: orders.length,
        revenus: Math.round(orders.reduce((sum, o) => sum + o.amount, 0) / 100),
        affiliesActifs: topAffiliates.length,
        commissionsAPayer,
      }}
      salesByProduct={salesByProduct}
      topAffiliates={topAffiliates}
      products={products}
    />
  )
}
