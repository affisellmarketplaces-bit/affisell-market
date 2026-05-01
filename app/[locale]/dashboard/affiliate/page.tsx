import { auth } from "@/auth"
import { ensureAffiliateStore } from "@/lib/ensure-affiliate-store"
import { prisma } from "@/lib/prisma"
import { redirect } from "@/i18n/navigation"
import { getTranslations } from "next-intl/server"

import { AffiliateLiveDashboard } from "./live-dashboard"

export const dynamic = "force-dynamic"

export default async function AffiliateDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const sess = await auth()
  if (!sess?.user?.id || !sess.user.email) {
    redirect({ href: "/login", locale })
  }
  if (sess.user.role !== "AFFILIATE") {
    redirect({ href: "/dashboard/supplier", locale })
  }

  const user = sess.user
  const tAff = await getTranslations({ locale, namespace: "affiliate" })
  await ensureAffiliateStore(user.id, user.email)

  const store = await prisma.affiliateStore.findUnique({ where: { userId: user.id } })

  const siteBase = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "")
  const boutiqueHref = store ? `${siteBase}/boutique/${store.slug}` : null

  const catalog = await prisma.product.findMany({
    where: { active: true },
    include: { supplier: true },
    orderBy: { name: "asc" },
  })

  const listingRows = await prisma.affiliateProduct.findMany({
    where: { affiliateId: user.id },
    include: {
      product: { include: { supplier: true } },
    },
    orderBy: { id: "desc" },
  })
  type LRow = (typeof listingRows)[number]

  const myOrders = await prisma.order.findMany({
    where: { affiliateId: user.id },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { product: true },
  })
  type ORow = (typeof myOrders)[number]

  const totalPayoutCents = myOrders.reduce((s: number, o: ORow) => s + o.affiliatePayoutCents, 0)

  const payoutByDayRaw = Array.from({ length: 30 }, (_, idx) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - idx))
    return d.toISOString().slice(0, 10)
  }).map((dayKey) => {
    const slice = myOrders.filter((o: ORow) => o.createdAt.toISOString().slice(0, 10) === dayKey)
    const cents = slice.reduce((s: number, o: ORow) => s + o.affiliatePayoutCents, 0)
    return { day: dayKey.slice(8), revenus: cents }
  })

  const recentSales = myOrders.slice(0, 15).map((o: ORow) => ({
    date: o.createdAt.toLocaleDateString("en-US"),
    produit: o.product.name,
    payout: Math.round(o.affiliatePayoutCents),
  }))

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{tAff("myStore")}</p>
      </div>
      <AffiliateLiveDashboard
        user={{ id: user.id, email: user.email ?? null }}
        boutiqueHref={boutiqueHref}
        storefrontSlug={store?.slug ?? null}
        kpis={{
          payoutsCents: totalPayoutCents,
          orders: myOrders.length,
        }}
        revenus30j={payoutByDayRaw}
        recentSales={recentSales}
        products={catalog}
        listings={listingRows}
      />
    </>
  )
}
