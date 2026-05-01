import { auth } from "@/auth"
import { redirect } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"

import { FournisseurLiveDashboard } from "./live-dashboard"

export default async function FournisseurDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const sess = await auth()
  if (!sess?.user?.id) {
    redirect({ href: "/login", locale })
  }
  const user = sess!.user
  const tSup = await getTranslations({ locale, namespace: "supplier" })

  const products = await prisma.product.findMany({
    where: { supplierId: user.id },
    orderBy: { createdAt: "desc" },
  })
  type SupplierProduct = (typeof products)[number]

  const productIds = products.map((p: SupplierProduct) => p.id)

  const orders =
    productIds.length > 0
      ? await prisma.order.findMany({
          where: { productId: { in: productIds } },
        })
      : []

  const salesByProductRaw =
    productIds.length > 0
      ? await prisma.order.groupBy({
          by: ["productId"],
          where: { productId: { in: productIds } },
          _count: { id: true },
        })
      : []

  const topAffiliatesRaw =
    productIds.length > 0
      ? await prisma.order.groupBy({
          by: ["affiliateId"],
          where: {
            productId: { in: productIds },
            affiliateId: { not: null },
          },
          _count: { id: true },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
          take: 5,
        })
      : []

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
    affiliates.map((a) => [a.id, a.name || a.email || "Affiliate"] as const)
  )

  const salesByProduct = salesByProductRaw.map((row) => ({
    produit: nameByProductId.get(row.productId ?? "") ?? "—",
    ventes: row._count.id,
  }))

  const topAffiliates = topAffiliatesRaw.map((row) => ({
    nom: affiliateById.get(row.affiliateId ?? "") ?? "—",
    ventes: row._count.id,
    commission: Math.round(((row._sum.amount ?? 0) * 0.3) / 100),
  }))

  const commissionsAPayer = topAffiliates.reduce((sum, a) => sum + a.commission, 0)

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{tSup("myProducts")}</p>
      </div>
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
    </>
  )
}
