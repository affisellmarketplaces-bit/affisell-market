import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { CommissionExplainer } from "@/components/legal/commission-explainer"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function DashboardOrderDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/orders")

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      product: { select: { name: true, images: true } },
      supplier: { select: { id: true, store: { select: { showRevenueToAffiliate: true } } } },
      affiliate: { select: { id: true, store: { select: { partnerListingCode: true } } } },
    },
  })
  if (!order) notFound()

  const userId = session.user.id
  const role =
    order.supplierId === userId
      ? ("SUPPLIER" as const)
      : order.affiliateId === userId
        ? ("AFFILIATE" as const)
        : order.buyerUserId === userId
          ? ("CUSTOMER" as const)
          : null

  if (!role) notFound()

  const backHref =
    role === "SUPPLIER"
      ? "/dashboard/supplier/orders"
      : role === "AFFILIATE"
        ? "/dashboard/affiliate/earnings"
        : "/marketplace/account/orders"

  const showRevenueToAffiliate = order.supplier.store?.showRevenueToAffiliate ?? false

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-6 py-10">
        <Link href={backHref} className="text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300">
          ← Retour aux commandes
        </Link>

        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Commande {order.id.slice(0, 8)}…</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{order.product.name}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Statut : {order.status} · {new Date(order.createdAt).toLocaleString("fr-FR")}
          </p>
        </header>

        <CommissionExplainer
          role={role}
          order={order}
          showRevenueToAffiliate={showRevenueToAffiliate}
        />

        <div className="flex flex-wrap gap-2 text-sm">
          {role === "SUPPLIER" ? (
            <a
              href={`/api/orders/${order.id}/invoice?type=SUPPLIER`}
              className="rounded-full border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Télécharger facture wholesale
            </a>
          ) : null}
          {role === "AFFILIATE" ? (
            <a
              href={`/api/orders/${order.id}/invoice?type=AFFILIATE`}
              className="rounded-full border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Note de commission
            </a>
          ) : null}
          {role === "CUSTOMER" ? (
            <a
              href={`/api/orders/${order.id}/invoice?type=CUSTOMER`}
              className="rounded-full border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Facture TTC {formatStoreCurrencyFromCents(order.totalCents ?? 0)}
            </a>
          ) : null}
          <Link
            href="/dashboard/account/gdpr"
            className="rounded-full px-4 py-2 font-medium text-zinc-600 hover:underline dark:text-zinc-400"
          >
            Données personnelles
          </Link>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
