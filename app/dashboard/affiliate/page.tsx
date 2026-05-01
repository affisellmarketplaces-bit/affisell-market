import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { AffiliateLiveDashboard } from "./live-dashboard"

const MOCK_USER = {
  id: "mock-affiliate",
  name: "Affilie Demo",
  email: "affilie.demo@affisell.local",
}

export default async function AffiliateDashboardPage() {
  const session = await auth()
  const user =
    session?.user?.id
      ? {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        }
      : MOCK_USER

  const orders = await prisma.order.findMany({
    where: { affiliateId: user.id },
    include: {
      product: {
        select: { name: true, commissionPercent: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const now = new Date()
  const last30 = Array.from({ length: 30 }, (_, idx) => {
    const d = new Date(now)
    d.setDate(now.getDate() - (29 - idx))
    const day = d.toISOString().slice(0, 10)
    const dayOrders = orders.filter(
      (o) => o.createdAt.toISOString().slice(0, 10) === day
    )
    const revenus = dayOrders.reduce(
      (sum, o) =>
        sum + Math.round((o.amount * (o.product?.commissionPercent ?? 30)) / 10000),
      0
    )
    return { day: d.getDate().toString(), revenus }
  })

  const commissionsMois = last30.reduce((s, d) => s + d.revenus, 0)
  const conversions = orders.length
  const clics = conversions * 12
  const taux = clics ? (conversions / clics) * 100 : 0

  const ventesRecentes = orders.slice(0, 8).map((o) => ({
    date: o.createdAt.toLocaleDateString("fr-FR"),
    produit: o.product?.name ?? "Produit",
    commission: Math.round((o.amount * (o.product?.commissionPercent ?? 30)) / 10000),
  }))

  return (
    <AffiliateLiveDashboard
      user={user}
      kpis={{ commissionsMois, clics, conversions, taux }}
      revenus30j={last30}
      ventesRecentes={ventesRecentes}
    />
  )
}
