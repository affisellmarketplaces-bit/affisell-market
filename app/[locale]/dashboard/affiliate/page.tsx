import { auth } from "@/auth"
import { ensureAffiliateStore } from "@/lib/ensure-affiliate-store"
import { prisma } from "@/lib/prisma"
import { redirect } from "@/i18n/navigation"
import { getTranslations } from "next-intl/server"

import { AffiliateLiveDashboard } from "./live-dashboard"

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
  const user = sess!.user
  const tAff = await getTranslations({ locale, namespace: "affiliate" })

  const email = sess!.user.email as string
  const store =
    sess!.user.role === "AFFILIATE" || sess!.user.role === "ADMIN"
      ? await ensureAffiliateStore(user.id, email)
      : null

  const siteBase = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "")
  const boutiqueHostDisplay = siteBase.replace(/^https?:\/\//, "")
  const boutiquePublicLabel = store
    ? `${boutiqueHostDisplay}/${locale}/boutique/${store.slug}`
    : null
  const boutiqueHref = store ? `${siteBase}/${locale}/boutique/${store.slug}` : null

  const products = await prisma.product.findMany({
    where: { active: true },
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
  })
  type CatalogProduct = (typeof products)[number]

  const selectionRows = await prisma.affiliateProduct.findMany({
    where: { affiliateId: user.id },
    include: {
      product: { include: { supplier: true } },
    },
    orderBy: { addedAt: "desc" },
  })
  type SelRow = (typeof selectionRows)[number]
  type SelProduct = NonNullable<SelRow["product"]>

  const selection = selectionRows
    .map((r: SelRow) => r.product)
    .filter((p: SelProduct | null): p is SelProduct => Boolean(p) && p.active)

  const commissionByProductId = new Map(
    products.map((p: CatalogProduct) => [p.id, p.commissionPercent] as const)
  )

  const myOrders = await prisma.order.findMany({
    where: { affiliateId: user.id },
    include: { product: { select: { commissionPercent: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  type OrderRow = (typeof myOrders)[number]

  const commissions = myOrders.reduce((sum: number, o: OrderRow) => {
    const percent =
      o.product?.commissionPercent ??
      commissionByProductId.get(o.productId ?? "") ??
      30
    return sum + (o.amount * percent) / 100
  }, 0)

  const now = new Date()
  const last30 = Array.from({ length: 30 }, (_, idx) => {
    const d = new Date(now)
    d.setDate(now.getDate() - (29 - idx))
    const dayKey = d.toISOString().slice(0, 10)
    const dayOrders = myOrders.filter((o: OrderRow) => o.createdAt.toISOString().slice(0, 10) === dayKey)
    const revenus = dayOrders.reduce((sum: number, o: OrderRow) => {
      const percent =
        o.product?.commissionPercent ??
        commissionByProductId.get(o.productId ?? "") ??
        30
      return sum + (o.amount * percent) / 100
    }, 0)
    return { day: d.getDate().toString(), revenus }
  })

  const conversions = myOrders.length
  const clics = myOrders.length * 10
  const taux = clics ? (conversions / clics) * 100 : 0

  const ventesRecentes = myOrders.slice(0, 8).map((o: OrderRow) => ({
    date: o.createdAt.toLocaleDateString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US"),
    produit:
      products.find((p: CatalogProduct) => p.id === o.productId)?.name ??
      selection.find((p: SelProduct) => p.id === o.productId)?.name ??
      tAff("orderSnippet", { id: o.id.slice(0, 8) }),
    commission: Math.round(
      (o.amount *
        (o.product?.commissionPercent ??
          commissionByProductId.get(o.productId ?? "") ??
          30)) /
        100
    ),
  }))

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{tAff("myStore")}</p>
      </div>
      <AffiliateLiveDashboard
        user={user}
        boutiquePublicLabel={boutiquePublicLabel}
        boutiqueHref={boutiqueHref}
        kpis={{
          commissionsMois: Math.round(commissions),
          clics,
          conversions,
          taux,
        }}
        revenus30j={last30}
        ventesRecentes={ventesRecentes}
        products={products}
        selection={selection}
      />
    </>
  )
}
