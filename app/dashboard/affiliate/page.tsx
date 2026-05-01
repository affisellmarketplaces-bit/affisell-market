import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { AffiliateLiveDashboard } from "./live-dashboard"

export default async function AffiliateDashboardPage() {
  const session = await auth()
  const user =
    session?.user ?? {
      id: "seed-affiliate",
      email: "affilie@test.dev",
      name: "Affilié Test",
    }

  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, email: user.email!, name: user.name },
  })

  const products = await prisma.product.findMany({
    where: { active: true },
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
  })
  const commissionByProductId = new Map(
    products.map((p) => [p.id, p.commissionPercent] as const)
  )

  const myOrders = await prisma.order.findMany({
    where: { affiliateId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const commissions = myOrders.reduce((sum, o) => {
    const percent = commissionByProductId.get(o.productId ?? "") ?? 30
    return sum + (o.amount * percent) / 100
  }, 0)

  const now = new Date()
  const last30 = Array.from({ length: 30 }, (_, idx) => {
    const d = new Date(now)
    d.setDate(now.getDate() - (29 - idx))
    const day = d.toISOString().slice(0, 10)
    const dayOrders = myOrders.filter(
      (o) => o.createdAt.toISOString().slice(0, 10) === day
    )
    const revenus = dayOrders.reduce((sum, o) => {
      const percent = commissionByProductId.get(o.productId ?? "") ?? 30
      return sum + (o.amount * percent) / 100
    }, 0)
    return { day: d.getDate().toString(), revenus }
  })

  const conversions = myOrders.length
  const clics = myOrders.length * 10
  const taux = clics ? (conversions / clics) * 100 : 0

  const ventesRecentes = myOrders.slice(0, 8).map((o) => ({
    date: o.createdAt.toLocaleDateString("fr-FR"),
    produit:
      products.find((p) => p.id === o.productId)?.name ?? `Commande ${o.id.slice(0, 8)}`,
    commission: Math.round(
      (o.amount * (commissionByProductId.get(o.productId ?? "") ?? 30)) / 100
    ),
  }))

  return (
    <AffiliateLiveDashboard
      user={user}
      kpis={{ commissionsMois: Math.round(commissions), clics, conversions, taux }}
      revenus30j={last30}
      ventesRecentes={ventesRecentes}
      products={products}
    />
  )
}
